import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import {
  checkPassword,
  clearAuthCookie,
  openStore,
  publicUser,
  registerUser,
  requireStore,
  requireUser,
  setAuthCookie,
  storesFor,
  workspaceOf,
} from './auth.js';
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

function sendError(error, res, next) {
  if (error.status) return res.status(error.status).json({ error: error.message });
  return next(error);
}

api.get('/health', (req, res) => {
  res.json({ ok: true });
});

api.post('/auth/signup', async (req, res, next) => {
  try {
    const user = await registerUser(req.body || {});
    setAuthCookie(res, user._id);
    res.status(201).json({ user: publicUser(user), stores: await storesFor(user._id) });
  } catch (error) {
    sendError(error, res, next);
  }
});

api.post('/auth/login', async (req, res, next) => {
  try {
    const user = await checkPassword(req.body?.email, req.body?.password);
    if (!user) return res.status(401).json({ error: 'Email or password is wrong.' });
    setAuthCookie(res, user._id);
    res.json({ user: publicUser(user), stores: await storesFor(user._id) });
  } catch (error) {
    next(error);
  }
});

api.post('/auth/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

api.get('/samples/:name', (req, res) => {
  if (!['orders', 'payments', 'bank'].includes(req.params.name)) {
    return res.status(404).json({ error: 'Unknown sample' });
  }
  const file = path.join(rootDir, 'samples', `${req.params.name}.csv`);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'Sample missing' });
  return res.download(file);
});

api.use(requireUser);

api.get('/auth/me', async (req, res, next) => {
  try {
    res.json({ user: publicUser(req.user), stores: await storesFor(req.user._id) });
  } catch (error) {
    next(error);
  }
});

api.post('/stores', async (req, res, next) => {
  try {
    await openStore(req.user, req.body || {});
    res.status(201).json({ stores: await storesFor(req.user._id) });
  } catch (error) {
    sendError(error, res, next);
  }
});

api.use(requireStore);

api.get('/overview', async (req, res, next) => {
  try {
    const scope = { storeId: req.store._id };
    const books = workspaceOf(req.store, req.user);
    const [matches, exceptions, audits, orders] = await Promise.all([
      Match.find(scope).lean(),
      Exception.find(scope).lean(),
      Audit.find(scope).sort({ createdAt: -1 }).limit(6).lean(),
      Order.countDocuments(scope),
    ]);
    const open = exceptions.filter((item) => item.status !== 'resolved');
    res.json({
      books,
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
    const query = { storeId: req.store._id };
    if (req.query.status) query.status = req.query.status;
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
    const match = await Match.findOne({ _id: req.params.id, storeId: req.store._id });
    if (!match || match.status !== 'suggested') return res.status(404).json({ error: 'Suggestion not found' });
    match.status = 'confirmed';
    await match.save();
    await Audit.create({
      storeId: req.store._id,
      actor: req.user.name,
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
    const match = await Match.findOne({ _id: req.params.id, storeId: req.store._id });
    if (!match || match.status !== 'suggested') return res.status(404).json({ error: 'Suggestion not found' });
    match.status = 'rejected';
    await match.save();
    await Audit.create({
      storeId: req.store._id,
      actor: req.user.name,
      action: 'Rejected match',
      detail: match.explanation,
    });
    await runReconcile(req.store._id);
    res.json(match);
  } catch (error) {
    next(error);
  }
});

api.get('/exceptions', async (req, res, next) => {
  try {
    const books = workspaceOf(req.store, req.user);
    const items = await Exception.find({ storeId: req.store._id }).sort({ priority: -1 }).lean();
    res.json(items.map((item) => ({ ...item, draft: followUpDraft(item, books) })));
  } catch (error) {
    next(error);
  }
});

api.post('/exceptions/:id', async (req, res, next) => {
  try {
    const item = await Exception.findOne({ _id: req.params.id, storeId: req.store._id });
    if (!item) return res.status(404).json({ error: 'Exception not found' });
    if (req.body.status) {
      if (!STATUSES.includes(req.body.status)) return res.status(400).json({ error: 'Unknown status' });
      item.status = req.body.status;
    }
    if (req.body.owner) item.owner = String(req.body.owner).slice(0, 80);
    if (req.body.note != null) item.note = String(req.body.note).slice(0, 1000);
    await item.save();
    await Audit.create({
      storeId: req.store._id,
      actor: req.user.name,
      action: 'Updated exception',
      detail: `${item.title} Status ${item.status}, owner ${item.owner}.`,
    });
    res.json({ ...item.toObject(), draft: followUpDraft(item, workspaceOf(req.store, req.user)) });
  } catch (error) {
    next(error);
  }
});

api.post('/orders/:orderId/mark-paid', async (req, res, next) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId, storeId: req.store._id });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    order.status = 'paid';
    await order.save();
    await Exception.updateMany(
      { storeId: req.store._id, orderId: order.orderId, kind: 'order_unpaid_despite_payment', status: { $ne: 'resolved' } },
      { status: 'resolved', note: 'Order marked paid after the captured payment was reviewed.' },
    );
    await Audit.create({
      storeId: req.store._id,
      actor: req.user.name,
      action: 'Marked order paid',
      detail: `${order.orderId} ${order.customer}`,
    });
    await runReconcile(req.store._id);
    res.json(order);
  } catch (error) {
    next(error);
  }
});

api.get('/orders', async (req, res, next) => {
  try {
    const orders = await Order.find({ storeId: req.store._id }).sort({ placedAt: -1 }).lean();
    res.json(orders);
  } catch (error) {
    next(error);
  }
});

api.get('/lineage/:orderId', async (req, res, next) => {
  try {
    const { orders, payments, bank, matches } = await loadBooks(req.store._id);
    const order = orders.find((item) => item.orderId === req.params.orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(buildLineage({ order, payments, bank, matches }));
  } catch (error) {
    next(error);
  }
});

api.get('/leakage', async (req, res, next) => {
  try {
    const items = await Exception.find({ storeId: req.store._id }).lean();
    const fees = items.filter((item) => item.kind === 'fee_above_contract');
    const unpaid = items.filter((item) => item.kind === 'order_unpaid_despite_payment');
    const channels = {};
    for (const item of unpaid) {
      const key = item.channel || 'Unknown';
      channels[key] = channels[key] || { count: 0, amountPaise: 0 };
      channels[key].count += 1;
      channels[key].amountPaise += item.amountPaise;
    }
    const books = workspaceOf(req.store, req.user);
    res.json({
      provider: books.gateway,
      contract: `${books.contractedFeeBps / 100}%`,
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
    res.json(await Audit.find({ storeId: req.store._id }).sort({ createdAt: -1 }).limit(40).lean());
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
    const result = await importCsv(req.params.source, req.file.buffer, req.store._id);
    await runReconcile(req.store._id);
    await Audit.create({
      storeId: req.store._id,
      actor: req.user.name,
      action: 'Imported CSV',
      detail: `${req.params.source}: ${result.inserted} added, ${result.skipped} duplicates, ${result.errors.length} bad rows.`,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

api.post('/reset', async (req, res, next) => {
  try {
    await seedBooks(req.store._id);
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
