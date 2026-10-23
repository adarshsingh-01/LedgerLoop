import { Audit, BankTxn, Exception, Match, Order, Payment } from './models.js';
import { runReconcile } from './run.js';

const rs = (rupees) => Math.round(rupees * 100);
const at = (iso) => new Date(iso);

function order(orderId, customer, rupees, status, channel, placedAt, product) {
  return { orderId, customer, amountPaise: rs(rupees), status, channel, product, placedAt: at(placedAt) };
}

function capture(paymentId, reference, rupees, orderId, customer, paidAt, extra = {}) {
  return {
    paymentId,
    type: 'capture',
    provider: 'Razorpay',
    reference,
    amountPaise: rs(rupees),
    feePaise: extra.fee ? rs(extra.fee) : 0,
    orderId,
    customer,
    paidAt: at(paidAt),
    settlementId: extra.settlementId || '',
  };
}

function bank(bankId, rupees, direction, postedAt, narration, reference = '') {
  return { bankId, amountPaise: rs(rupees), direction, postedAt: at(postedAt), narration, reference };
}

function stamp(storeId, rows) {
  return rows.map((row) => ({ ...row, storeId }));
}

export async function seedBooks(storeId) {
  const scope = { storeId };
  await Promise.all([
    Order.deleteMany(scope),
    Payment.deleteMany(scope),
    BankTxn.deleteMany(scope),
    Match.deleteMany(scope),
    Exception.deleteMany(scope),
    Audit.deleteMany(scope),
  ]);

  await Order.insertMany(stamp(storeId, [
    order('1042', 'Priya Shah', 2499, 'unpaid', 'Website', '2026-10-21', 'Linen co-ord'),
    order('1043', 'Meera Iyer', 1899, 'paid', 'Website', '2026-10-22', 'Handloom saree'),
    order('1044', 'Kabir Das', 3299, 'paid', 'Instagram', '2026-10-22', 'Indigo shirt'),
    order('1045', 'Asha Menon', 12000, 'paid', 'Website', '2026-10-20', 'Studio set'),
    order('1046', 'Dev Patel', 9800, 'paid', 'Website', '2026-10-20', 'Kurta set'),
    order('1047', 'Nisha Rao', 14500, 'paid', 'Wholesale', '2026-10-20', 'Reseller carton'),
    order('1048', 'Omar Sheikh', 7600, 'paid', 'Website', '2026-10-20', 'Block-print edit'),
    order('1049', 'Leela Nair', 5100, 'paid', 'Website', '2026-10-20', 'Cotton dress'),
    order('1050', 'Rohan Mehta', 1200, 'unpaid', 'Website', '2026-10-20', 'Tee'),
    order('1051', 'Rohan Mehta', 1800, 'unpaid', 'Website', '2026-10-20', 'Shirt'),
    order('1055', 'Ananya Bose', 4999, 'unpaid', 'Instagram', '2026-10-20', 'Festive set'),
    order('1056', 'Diya Menon', 2200, 'unpaid', 'Instagram', '2026-10-21', 'Scarf'),
    order('1060', 'Farhan Qureshi', 899, 'refunded', 'Website', '2026-10-18', 'Returned shirt'),
    order('1062', 'Tara Sen', 2499, 'partial', 'Website', '2026-10-18', 'Split checkout'),
    order('1070', 'Vikram Seth', 15480, 'paid', 'Wholesale', '2026-10-16', 'Bulk kurtas'),
    order('1081', 'Rhea Kapoor', 2150, 'paid', 'Website', '2026-10-22', 'Silver earrings'),
    order('1082', 'Arjun Malhotra', 6400, 'paid', 'Website', '2026-10-19', 'Linen suit'),
    order('9102', 'Ishaan Gupta', 4000, 'paid', 'Website', '2026-10-11', 'Overshirt'),
    order('9108', 'Sara Khan', 2500, 'paid', 'Instagram', '2026-10-17', 'Dress'),
  ]));

  await Payment.insertMany(stamp(storeId, [
    capture('PAY-1042', 'UPI9921841', 2499, '1042', 'Priya Shah', '2026-10-21'),
    capture('PAY-1043', 'UTR2410224419', 1899, '1043', 'Meera Iyer', '2026-10-22'),
    capture('PAY-1044', 'UTR2410227781', 3299, '1044', 'Kabir Das', '2026-10-22'),
    capture('PAY-1045', 'PAY1045', 12000, '1045', 'Asha Menon', '2026-10-20', { settlementId: 'SET-8821' }),
    capture('PAY-1046', 'PAY1046', 9800, '1046', 'Dev Patel', '2026-10-20', { settlementId: 'SET-8821' }),
    capture('PAY-1047', 'PAY1047', 14500, '1047', 'Nisha Rao', '2026-10-20', { settlementId: 'SET-8821' }),
    capture('PAY-1048', 'PAY1048', 7600, '1048', 'Omar Sheikh', '2026-10-20', { settlementId: 'SET-8821' }),
    capture('PAY-1049', 'PAY1049', 5100, '1049', 'Leela Nair', '2026-10-20', { settlementId: 'SET-8821' }),
    capture('PAY-1055', 'UTR2410201555', 4999, '1055', 'Ananya Bose', '2026-10-20'),
    capture('PAY-1056', 'UTR2410211556', 2200, '1056', 'Diya Menon', '2026-10-21'),
    capture('PAY-1060', 'UTR2410181060', 899, '1060', 'Farhan Qureshi', '2026-10-18'),
    {
      paymentId: 'PAY-1060R', type: 'refund', provider: 'Razorpay', reference: 'RFND1060',
      amountPaise: rs(899), feePaise: 0, orderId: '1060', customer: 'Farhan Qureshi', paidAt: at('2026-10-20'), settlementId: '',
    },
    capture('PAY-1062A', 'UTR2410181001', 1000, '1062', 'Tara Sen', '2026-10-18'),
    capture('PAY-1062B', 'UTR2410191002', 1499, '1062', 'Tara Sen', '2026-10-19'),
    capture('PAY-1070', 'PAY1070VICK', 15480, '1070', 'Vikram Seth', '2026-10-16'),
    capture('PAY-1081', 'UTR2410221081', 2150, '1081', 'Rhea Kapoor', '2026-10-22'),
    capture('PAY-1082', 'UTR2410191082', 6400, '1082', 'Arjun Malhotra', '2026-10-19'),
    {
      paymentId: 'PAY-ORPHAN', type: 'capture', provider: 'Razorpay', reference: 'UTR2410227500',
      amountPaise: rs(750), feePaise: 0, orderId: '', customer: '', paidAt: at('2026-10-22'), settlementId: '',
    },
    capture('PAY-9102', 'PAY9102', 4000, '9102', 'Ishaan Gupta', '2026-10-11', { settlementId: 'SET-9102' }),
    capture('PAY-9108', 'PAY9108', 2500, '9108', 'Sara Khan', '2026-10-17', { settlementId: 'SET-9108' }),
    {
      paymentId: 'SET-8821', type: 'settlement', provider: 'Razorpay', reference: 'SET-8821',
      amountPaise: rs(48200), feePaise: rs(800), orderId: '', customer: '', paidAt: at('2026-10-22'), settlementId: '',
    },
    {
      paymentId: 'SET-9102', type: 'settlement', provider: 'Razorpay', reference: 'SET-9102',
      amountPaise: rs(3880), feePaise: rs(120), orderId: '', customer: '', paidAt: at('2026-10-13'), settlementId: '',
    },
    {
      paymentId: 'SET-9108', type: 'settlement', provider: 'Razorpay', reference: 'SET-9108',
      amountPaise: rs(2425), feePaise: rs(75), orderId: '', customer: '',       paidAt: at('2026-10-18'), settlementId: '',
    },
  ]));

  await BankTxn.insertMany(stamp(storeId, [
    bank('B-1042', 2499, 'credit', '2026-10-21', 'UPI/CR/P SHA/OKSBI'),
    bank('B-1043', 1899, 'credit', '2026-10-22', 'UPI/UTR2410224419/MEERA IYER', 'UTR2410224419'),
    bank('B-1044', 3299, 'credit', '2026-10-22', 'UPI/UTR2410227781/KABIR DAS', 'UTR2410227781'),
    bank('B-8821', 48200, 'credit', '2026-10-22', 'RAZORPAY SET-8821', 'SET-8821'),
    bank('B-ROHAN', 3000, 'credit', '2026-10-20', 'NEFT ROHAN MEHTA'),
    bank('B-1055', 4999, 'credit', '2026-10-20', 'UPI/UTR2410201555/ANANYA BOSE', 'UTR2410201555'),
    bank('B-1056', 2200, 'credit', '2026-10-21', 'UPI/UTR2410211556/DIYA MENON', 'UTR2410211556'),
    bank('B-1060', 899, 'credit', '2026-10-18', 'UPI/UTR2410181060/FARHAN', 'UTR2410181060'),
    bank('B-1062A', 1000, 'credit', '2026-10-18', 'UPI/UTR2410181001/TARA SEN', 'UTR2410181001'),
    bank('B-1062B', 1499, 'credit', '2026-10-19', 'UPI/UTR2410191002/TARA SEN', 'UTR2410191002'),
    bank('B-1081', 2150, 'credit', '2026-10-22', 'UPI/UTR2410221081/RHEA KAPOOR', 'UTR2410221081'),
    bank('B-1082', 6400, 'credit', '2026-10-19', 'UPI/UTR2410191082/ARJUN', 'UTR2410191082'),
    bank('B-ORPHAN', 750, 'credit', '2026-10-22', 'UPI/UTR2410227500/UNKNOWN', 'UTR2410227500'),
    bank('B-9102', 3880, 'credit', '2026-10-13', 'RAZORPAY SET-9102', 'SET-9102'),
    bank('B-9108', 2425, 'credit', '2026-10-18', 'RAZORPAY SET-9108', 'SET-9108'),
    bank('B-DUP1', 640, 'credit', '2026-10-19', 'UPI/DUPUTR77/UNKNOWN', 'DUPUTR77'),
    bank('B-DUP2', 640, 'credit', '2026-10-19', 'UPI/DUPUTR77/UNKNOWN', 'DUPUTR77'),
  ]));

  await runReconcile(storeId);
}
