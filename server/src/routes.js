import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import { BOOKS } from './books.js';
import { importCsv } from './csv.js';
import { followUpDraft } from './draft.js';
import { buildLineage } from './match.js';
import { Audit, Exception, Match, Order } from './models.js';
import { loadBooks, runReconcile } from './run.js';
import { seedBooks } from './seed.js';

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });
const STATUSES = ['open', 'investigating', 'waiting', 'resolved'];

export const api = Router();

api.get('/health', (req, res) => {
  res.json({ ok: true, books: BOOKS.name });
});

api.get('/overview', async (req, res, next) => {
  try {
    const [matches, exceptions, audits, orders] = await Promise.all([
      Match.find().lean(),
      Exception.find().lean(),
      Audit.find().sort({ createdAt: -1 }).limit(6).lean(),
      Order.countDocuments(),
    ]);
    const open = exceptions.filter((item) => item.status !== 'resolved');
    res.json({
      books: BOOKS,
      counts: {
        orders,
        confirmed: matches.filter((item) => item.status === 'confirmed').length,
        review: matches.filter((item) => item.status === 'suggested').length,
        open: open.length,
        openPaise: open.reduce((sum, item) => sum + item.amountPaise, 0),
      },
      review: matches.filter((item) => item.status === 'suggested').slice(0, 4),
      exceptions: open.sort((a, b) => b.priority - a.priority).slice(0, 4),
      audits,
    });
  } catch (error) {
    next(error);
  }
});

api.get('/matches', async (req, res, next) => {
  try {
    const status = req.query.status;
    const query = status ? { status } : {};
    const matches = await Match.find(query).lean();
    const rank = { suggested: 0, confirmed: 1, rejected: 2 };
    matches.sort((a, b) => rank[a.status] - rank[b.status] || b.confidence - a.confidence);
    res.json(matches);
  } catch (error) {
    next(error);
  }
});

api.post('/matches/:id/confirm', async (req, res, next) => {
  try {
    const match = await Match.findById(req.params.id);
    if (!match || match.status !== 'suggested') return res.status(404).json({ error: 'Suggestion not found' });
    match.status = 'confirmed';
    await match.save();
    await Audit.create({
      actor: BOOKS.operator,
      action: 'Confirmed match',
      detail: match.explanation,
    });
    res.json(match);
  } catch (error) {
    next(error);
  }
});

api.post('/matches/:id/reject', async (req, res, next) => {
  try {
    const match = await Match.findById(req.params.id);
    if (!match || match.status !== 'suggested') return res.status(404).json({ error: 'Suggestion not found' });
    match.status = 'rejected';
    await match.save();
    await Audit.create({
      actor: BOOKS.operator,
      action: 'Rejected match',
      detail: match.explanation,
    });
    await runReconcile();
    res.json(match);
  } catch (error) {
    next(error);
  }
});

api.get('/exceptions', async (req, res, next) => {
  try {
    const items = await Exception.find().sort({ priority: -1 }).lean();
    res.json(items.map((item) => ({ ...item, draft: followUpDraft(item) })));
  } catch (error) {
    next(error);
  }
});

api.post('/exceptions/:id', async (req, res, next) => {
  try {
    const item = await Exception.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Exception not found' });
    if (req.body.status) {
      if (!STATUSES.includes(req.body.status)) return res.status(400).json({ error: 'Unknown status' });
      item.status = req.body.status;
    }
    if (req.body.owner) item.owner = String(req.body.owner).slice(0, 80);
    if (req.body.note != null) item.note = String(req.body.note).slice(0, 1000);
    await item.save();
    await Audit.create({
      actor: BOOKS.operator,
      action: 'Updated exception',
      detail: `${item.title} Status ${item.status}, owner ${item.owner}.`,
    });
    res.json({ ...item.toObject(), draft: followUpDraft(item) });
  } catch (error) {
    next(error);
  }
});

api.post('/orders/:orderId/mark-paid', async (req, res, next) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    order.status = 'paid';
    await order.save();
    await Exception.updateMany(
      { orderId: order.orderId, kind: 'order_unpaid_despite_payment', status: { $ne: 'resolved' } },
      { status: 'resolved', note: 'Order marked paid after the captured payment was reviewed.' },
    );
    await Audit.create({
      actor: BOOKS.operator,
      action: 'Marked order paid',
      detail: `${order.orderId} ${order.customer}`,
    });
    await runReconcile();
    res.json(order);
  } catch (error) {
    next(error);
  }
});

api.get('/orders', async (req, res, next) => {
  try {
    const orders = await Order.find().sort({ placedAt: -1 }).lean();
    res.json(orders);
  } catch (error) {
    next(error);
  }
});

api.get('/lineage/:orderId', async (req, res, next) => {
  try {
    const { orders, payments, bank, matches } = await loadBooks();
    const order = orders.find((item) => item.orderId === req.params.orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(buildLineage({ order, payments, bank, matches }));
  } catch (error) {
    next(error);
  }
});

api.get('/leakage', async (req, res, next) => {
  try {
    const items = await Exception.find().lean();
    const fees = items.filter((item) => item.kind === 'fee_above_contract');
    const unpaid = items.filter((item) => item.kind === 'order_unpaid_despite_payment');
    const channels = {};
    for (const item of unpaid) {
      const key = item.channel || 'Unknown';
      channels[key] = channels[key] || { count: 0, amountPaise: 0 };
      channels[key].count += 1;
      channels[key].amountPaise += item.amountPaise;
    }
    res.json({
      provider: BOOKS.gateway,
      contract: '2%',
      fees: {
        count: fees.length,
        extraPaise: fees.reduce((sum, item) => sum + item.amountPaise, 0),
        items: fees,
      },
      channels,
      duplicates: items.filter((item) => item.kind === 'possible_duplicate'),
      delayed: items.filter((item) => item.kind === 'delayed_settlement'),
    });
  } catch (error) {
    next(error);
  }
});

api.get('/audit', async (req, res, next) => {
  try {
    res.json(await Audit.find().sort({ createdAt: -1 }).limit(40).lean());
  } catch (error) {
    next(error);
  }
});

api.post('/imports/:source', upload.single('file'), async (req, res, next) => {
  try {
    if (!['orders', 'payments', 'bank'].includes(req.params.source)) {
      return res.status(400).json({ error: 'Source must be orders, payments or bank.' });
    }
    if (!req.file) return res.status(400).json({ error: 'Choose a CSV file.' });
    const result = await importCsv(req.params.source, req.file.buffer);
    await runReconcile();
    await Audit.create({
      actor: BOOKS.operator,
      action: 'Imported CSV',
      detail: `${req.params.source}: ${result.inserted} added, ${result.skipped} duplicates, ${result.errors.length} bad rows.`,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

api.get('/samples/:name', (req, res) => {
  if (!['orders', 'payments', 'bank'].includes(req.params.name)) {
    return res.status(404).json({ error: 'Unknown sample' });
  }
  const file = path.join(rootDir, 'samples', `${req.params.name}.csv`);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'Sample missing' });
  res.download(file);
});

api.post('/reset', async (req, res, next) => {
  try {
    await seedBooks();
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

api.use((req, res) => res.status(404).json({ error: 'Not found' }));
api.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: 'Something went wrong while reading the books.' });
});
