import { STORE_DEFAULTS } from './books.js';
import { reconcile } from './match.js';
import { Audit, BankTxn, Exception, Match, Order, Payment, Store } from './models.js';

export async function runReconcile(storeId) {
  const store = await Store.findById(storeId).lean();
  const scope = { storeId };
  const [orders, payments, bank, kept] = await Promise.all([
    Order.find(scope).lean(),
    Payment.find(scope).lean(),
    BankTxn.find(scope).lean(),
    Match.find({ ...scope, status: { $in: ['confirmed', 'rejected'] } }).lean(),
  ]);

  const { matches, exceptions } = reconcile({
    orders,
    payments,
    bank,
    locked: kept.map((item) => item.fingerprint),
    contractedFeeBps: store?.contractedFeeBps || STORE_DEFAULTS.contractedFeeBps,
  });

  await Match.deleteMany({ ...scope, status: 'suggested' });
  const docs = matches.map((item) => ({
    ...item,
    storeId,
    status: item.autoConfirm ? 'confirmed' : 'suggested',
  }));
  if (docs.length) await Match.insertMany(docs);

  const autos = docs.filter((item) => item.autoConfirm);
  if (autos.length) {
    await Audit.insertMany(autos.map((item) => ({
      storeId,
      actor: 'LedgerLoop',
      action: 'Auto-confirmed match',
      detail: item.explanation,
    })));
  }

  const live = new Set(exceptions.map((item) => item.fingerprint));
  await Exception.deleteMany({ ...scope, status: 'open', fingerprint: { $nin: [...live] } });
  for (const item of exceptions) {
    const existing = await Exception.findOne({ storeId, fingerprint: item.fingerprint });
    if (!existing) await Exception.create({ ...item, storeId });
    else if (existing.status === 'open') {
      existing.set(item);
      existing.storeId = storeId;
      await existing.save();
    }
  }
}

export async function loadBooks(storeId) {
  const scope = { storeId };
  const [orders, payments, bank, matches] = await Promise.all([
    Order.find(scope).lean(),
    Payment.find(scope).lean(),
    BankTxn.find(scope).lean(),
    Match.find(scope).lean(),
  ]);
  return { orders, payments, bank, matches };
}
