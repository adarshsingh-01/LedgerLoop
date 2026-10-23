import mongoose from 'mongoose';

const evidenceSchema = new mongoose.Schema({
  signal: String,
  detail: String,
}, { _id: false });

const linkSchema = new mongoose.Schema({
  type: String,
  id: String,
  role: String,
  amountPaise: Number,
}, { _id: false });

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  passwordHash: { type: String, select: false },
}, { timestamps: true });

const storeSchema = new mongoose.Schema({
  name: String,
  city: String,
  gateway: { type: String, default: 'Razorpay' },
  bankName: { type: String, default: 'HDFC Bank' },
  contractedFeeBps: { type: Number, default: 200 },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
}, { timestamps: true });

const orderSchema = new mongoose.Schema({
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', index: true },
  orderId: String,
  customer: String,
  amountPaise: Number,
  status: String,
  channel: String,
  product: String,
  placedAt: Date,
});

const paymentSchema = new mongoose.Schema({
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', index: true },
  paymentId: String,
  type: String,
  provider: String,
  reference: String,
  amountPaise: Number,
  feePaise: Number,
  orderId: String,
  customer: String,
  paidAt: Date,
  settlementId: String,
});

const bankSchema = new mongoose.Schema({
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', index: true },
  bankId: String,
  reference: String,
  narration: String,
  amountPaise: Number,
  direction: String,
  postedAt: Date,
});

const matchSchema = new mongoose.Schema({
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', index: true },
  fingerprint: String,
  rule: String,
  title: String,
  confidence: Number,
  autoConfirm: Boolean,
  explanation: String,
  evidence: [evidenceSchema],
  links: [linkSchema],
  status: { type: String, default: 'suggested' },
});

const exceptionSchema = new mongoose.Schema({
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', index: true },
  fingerprint: String,
  kind: String,
  title: String,
  summary: String,
  nextStep: String,
  amountPaise: Number,
  channel: String,
  provider: String,
  orderId: String,
  occurredAt: Date,
  priority: Number,
  status: { type: String, default: 'open' },
  owner: { type: String, default: 'Unassigned' },
  note: { type: String, default: '' },
});

const auditSchema = new mongoose.Schema({
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', index: true },
  actor: String,
  action: String,
  detail: String,
  createdAt: { type: Date, default: Date.now },
});

orderSchema.index({ storeId: 1, orderId: 1 }, { unique: true });
paymentSchema.index({ storeId: 1, paymentId: 1 }, { unique: true });
bankSchema.index({ storeId: 1, bankId: 1 }, { unique: true });
matchSchema.index({ storeId: 1, fingerprint: 1 }, { unique: true });
exceptionSchema.index({ storeId: 1, fingerprint: 1 }, { unique: true });

export const User = mongoose.model('User', userSchema);
export const Store = mongoose.model('Store', storeSchema);
export const Order = mongoose.model('Order', orderSchema);
export const Payment = mongoose.model('Payment', paymentSchema);
export const BankTxn = mongoose.model('BankTxn', bankSchema);
export const Match = mongoose.model('Match', matchSchema);
export const Exception = mongoose.model('Exception', exceptionSchema);
export const Audit = mongoose.model('Audit', auditSchema);
