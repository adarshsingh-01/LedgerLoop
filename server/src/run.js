import { BOOKS } from './books.js';
import { reconcile } from './match.js';
import { Audit, BankTxn, Exception, Match, Order, Payment } from './models.js';

export async function runReconcile() {
  const [orders, payments, bank, kept] = await Promise.all([
    Order.find().lean(),
    Payment.find().lean(),
    BankTxn.find().lean(),
    Match.find({ status: { $in: ['confirmed', 'rejected'] } }).lean(),
  ]);

  const { matches, exceptions } = reconcile({
    orders,
    payments,
    bank,
    locked: kept.map((item) => item.fingerprint),
    contractedFeeBps: BOOKS.contractedFeeBps,
  });

  await Match.deleteMany({ status: 'suggested' });
  const docs = matches.map((item) => ({
    ...item,
    status: item.autoConfirm ? 'confirmed' : 'suggested',
  }));
  if (docs.length) await Match.insertMany(docs);

  const autos = docs.filter((item) => item.autoConfirm);
  if (autos.length) {
    await Audit.insertMany(autos.map((item) => ({
      actor: 'LedgerLoop',
      action: 'Auto-confirmed match',
      detail: item.explanation,
    })));
  }

  const live = new Set(exceptions.map((item) => item.fingerprint));
  await Exception.deleteMany({ status: 'open', fingerprint: { $nin: [...live] } });
  for (const item of exceptions) {
    const existing = await Exception.findOne({ fingerprint: item.fingerprint });
    if (!existing) await Exception.create(item);
    else if (existing.status === 'open') {
      existing.set(item);
      await existing.save();
    }
  }
}

export async function loadBooks() {
  const [orders, payments, bank, matches] = await Promise.all([
    Order.find().lean(),
    Payment.find().lean(),
    BankTxn.find().lean(),
    Match.find().lean(),
  ]);
  return { orders, payments, bank, matches };
}
