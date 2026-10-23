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

const orderSchema = new mongoose.Schema({
  orderId: { type: String, unique: true },
  customer: String,
  amountPaise: Number,
  status: String,
  channel: String,
  product: String,
  placedAt: Date,
});

const paymentSchema = new mongoose.Schema({
  paymentId: { type: String, unique: true },
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
  bankId: { type: String, unique: true },
  reference: String,
  narration: String,
  amountPaise: Number,
  direction: String,
  postedAt: Date,
});

const matchSchema = new mongoose.Schema({
  fingerprint: { type: String, unique: true },
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
  fingerprint: { type: String, unique: true },
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
  actor: String,
  action: String,
  detail: String,
  createdAt: { type: Date, default: Date.now },
});

export const Order = mongoose.model('Order', orderSchema);
export const Payment = mongoose.model('Payment', paymentSchema);
export const BankTxn = mongoose.model('BankTxn', bankSchema);
export const Match = mongoose.model('Match', matchSchema);
export const Exception = mongoose.model('Exception', exceptionSchema);
export const Audit = mongoose.model('Audit', auditSchema);
