import { Audit, BankTxn, Exception, Match, Order, Payment, Store, User } from './models.js';

const legacyFields = [
  [Order, 'orderId'],
  [Payment, 'paymentId'],
  [BankTxn, 'bankId'],
  [Match, 'fingerprint'],
  [Exception, 'fingerprint'],
];

export async function repairIndexes() {
  for (const [Model, field] of legacyFields) {
    const current = await Model.collection.indexes();
    for (const index of current) {
      const keys = Object.keys(index.key || {});
      if (index.unique && keys.length === 1 && keys[0] === field) {
        await Model.collection.dropIndex(index.name);
      }
    }
  }
  await Promise.all([
    User.syncIndexes(),
    Store.syncIndexes(),
    Order.syncIndexes(),
    Payment.syncIndexes(),
    BankTxn.syncIndexes(),
    Match.syncIndexes(),
    Exception.syncIndexes(),
    Audit.syncIndexes(),
  ]);
}

const missingStore = { $or: [{ storeId: { $exists: false } }, { storeId: null }] };

export async function parkExistingBooks() {
  const count = await Order.countDocuments(missingStore);
  if (!count) return null;
  const store = await Store.create({
    name: 'Nila Studio',
    city: 'Kolkata',
    gateway: 'Razorpay',
    bankName: 'HDFC Bank',
    contractedFeeBps: 200,
    ownerId: null,
  });
  await Promise.all([
    Order.updateMany(missingStore, { storeId: store._id }),
    Payment.updateMany(missingStore, { storeId: store._id }),
    BankTxn.updateMany(missingStore, { storeId: store._id }),
    Match.updateMany(missingStore, { storeId: store._id }),
    Exception.updateMany(missingStore, { storeId: store._id }),
    Audit.updateMany(missingStore, { storeId: store._id }),
  ]);
  console.log(`Attached existing books to ${store.name}`);
  return store;
}
