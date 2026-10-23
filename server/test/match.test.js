import assert from 'node:assert/strict';
import test from 'node:test';
import { buildLineage, reconcile } from '../src/match.js';

const now = new Date('2026-10-23T12:00:00+05:30');
const rs = (rupees) => rupees * 100;

function run(data) {
  return reconcile(data, now);
}

test('an exact reference match confirms itself', () => {
  const { matches } = run({
    orders: [{ orderId: '1043', customer: 'Meera Iyer', amountPaise: rs(1899), status: 'paid', channel: 'Website' }],
    payments: [{ paymentId: 'P1', type: 'capture', provider: 'Razorpay', reference: 'UTR2410224419', amountPaise: rs(1899), feePaise: 0, orderId: '1043', customer: 'Meera Iyer', paidAt: '2026-10-22', settlementId: '' }],
    bank: [{ bankId: 'B1', reference: 'UTR2410224419', narration: 'UPI/UTR2410224419/MEERA IYER', amountPaise: rs(1899), direction: 'credit', postedAt: '2026-10-22' }],
  });
  const match = matches.find((item) => item.rule === 'exact_reference');
  assert.equal(match.autoConfirm, true);
  assert.equal(match.confidence, 0.99);
});

test('a nickname on the statement stays a suggestion', () => {
  const { matches } = run({
    orders: [{ orderId: '1042', customer: 'Priya Shah', amountPaise: rs(2499), status: 'unpaid', channel: 'Website' }],
    payments: [{ paymentId: 'P1', type: 'capture', provider: 'Razorpay', reference: 'UPI9921841', amountPaise: rs(2499), feePaise: 0, orderId: '1042', customer: 'Priya Shah', paidAt: '2026-10-21', settlementId: '' }],
    bank: [{ bankId: 'B1', reference: '', narration: 'UPI/CR/P SHA/OKSBI', amountPaise: rs(2499), direction: 'credit', postedAt: '2026-10-21' }],
  });
  const match = matches.find((item) => item.rule === 'customer_amount');
  assert.ok(match);
  assert.equal(match.autoConfirm, false);
  assert.match(match.explanation, /not confirmed/);
});

test('one transfer can cover two invoices for the same customer', () => {
  const { matches } = run({
    orders: [
      { orderId: '1050', customer: 'Rohan Mehta', amountPaise: rs(1200), status: 'unpaid', channel: 'Website' },
      { orderId: '1051', customer: 'Rohan Mehta', amountPaise: rs(1800), status: 'unpaid', channel: 'Website' },
    ],
    payments: [],
    bank: [{ bankId: 'B1', reference: '', narration: 'NEFT ROHAN MEHTA', amountPaise: rs(3000), direction: 'credit', postedAt: '2026-10-20' }],
  });
  const match = matches.find((item) => item.rule === 'split_transfer');
  assert.ok(match);
  assert.equal(match.autoConfirm, false);
  assert.equal(match.links.filter((link) => link.type === 'order').length, 2);
});

test('settlement explains the fee gap and confirms when the bank credit equals the net', () => {
  const { matches, exceptions } = run({
    orders: [
      { orderId: '1', customer: 'Asha', amountPaise: rs(200), status: 'paid', channel: 'Website' },
      { orderId: '2', customer: 'Dev', amountPaise: rs(300), status: 'paid', channel: 'Website' },
    ],
    payments: [
      { paymentId: 'C1', type: 'capture', provider: 'Razorpay', reference: 'PAYC1001', amountPaise: rs(200), feePaise: 0, orderId: '1', customer: 'Asha', paidAt: '2026-10-20', settlementId: 'SET-1001' },
      { paymentId: 'C2', type: 'capture', provider: 'Razorpay', reference: 'PAYC1002', amountPaise: rs(300), feePaise: 0, orderId: '2', customer: 'Dev', paidAt: '2026-10-20', settlementId: 'SET-1001' },
      { paymentId: 'S1', type: 'settlement', provider: 'Razorpay', reference: 'SET-1001', amountPaise: rs(490), feePaise: rs(10), orderId: '', customer: '', paidAt: '2026-10-22', settlementId: '' },
    ],
    bank: [{ bankId: 'B1', reference: 'SET-1001', narration: 'RAZORPAY SET-1001', amountPaise: rs(490), direction: 'credit', postedAt: '2026-10-22' }],
  });
  const match = matches.find((item) => item.rule === 'settlement_net');
  assert.equal(match.autoConfirm, true);
  assert.match(match.explanation, /₹10/);
  assert.equal(exceptions.some((item) => item.kind === 'fee_above_contract'), false);
});

test('a fee above the 2% contract is called out even when the bank credit ties out', () => {
  const { exceptions, matches } = run({
    orders: [{ orderId: '1', customer: 'Ishaan', amountPaise: rs(1000), status: 'paid', channel: 'Website' }],
    payments: [
      { paymentId: 'C1', type: 'capture', provider: 'Razorpay', reference: 'PAYC9102', amountPaise: rs(1000), feePaise: 0, orderId: '1', customer: 'Ishaan', paidAt: '2026-10-11', settlementId: 'SET-9102' },
      { paymentId: 'S1', type: 'settlement', provider: 'Razorpay', reference: 'SET-9102', amountPaise: rs(970), feePaise: rs(30), orderId: '', customer: '', paidAt: '2026-10-13', settlementId: '' },
    ],
    bank: [{ bankId: 'B1', reference: 'SET-9102', narration: 'RAZORPAY SET-9102', amountPaise: rs(970), direction: 'credit', postedAt: '2026-10-13' }],
  });
  assert.equal(matches.some((item) => item.rule === 'settlement_net' && item.autoConfirm), true);
  const fee = exceptions.find((item) => item.kind === 'fee_above_contract');
  assert.ok(fee);
  assert.equal(fee.amountPaise, rs(10));
});

test('a refund with no debit becomes an exception', () => {
  const { exceptions } = run({
    orders: [{ orderId: '1060', customer: 'Farhan Qureshi', amountPaise: rs(899), status: 'refunded', channel: 'Website' }],
    payments: [{ paymentId: 'R1', type: 'refund', provider: 'Razorpay', reference: 'RFND1060', amountPaise: rs(899), feePaise: 0, orderId: '1060', customer: 'Farhan Qureshi', paidAt: '2026-10-20', settlementId: '' }],
    bank: [],
  });
  assert.equal(exceptions.some((item) => item.kind === 'refund_without_debit'), true);
});

test('a rejected fingerprint is not suggested again', () => {
  const input = {
    orders: [{ orderId: '1042', customer: 'Priya Shah', amountPaise: rs(2499), status: 'unpaid', channel: 'Website' }],
    payments: [{ paymentId: 'P1', type: 'capture', provider: 'Razorpay', reference: 'UPI9921841', amountPaise: rs(2499), feePaise: 0, orderId: '1042', customer: 'Priya Shah', paidAt: '2026-10-21', settlementId: '' }],
    bank: [{ bankId: 'B1', reference: '', narration: 'UPI/CR/P SHA/OKSBI', amountPaise: rs(2499), direction: 'credit', postedAt: '2026-10-21' }],
  };
  const first = run(input).matches.find((item) => item.rule === 'customer_amount');
  const second = run({ ...input, locked: [first.fingerprint] });
  assert.equal(second.matches.some((item) => item.fingerprint === first.fingerprint), false);
});

test('lineage shows where the trail breaks', () => {
  const order = { orderId: '1055', customer: 'Ananya Bose', amountPaise: rs(4999), status: 'unpaid', channel: 'Instagram', product: 'Festive set' };
  const payments = [{ paymentId: 'P1', type: 'capture', provider: 'Razorpay', reference: 'UTR1', amountPaise: rs(4999), feePaise: 0, orderId: '1055', customer: 'Ananya Bose', paidAt: '2026-10-20', settlementId: '' }];
  const bank = [{ bankId: 'B1', reference: 'UTR1', narration: 'UPI/UTR1', amountPaise: rs(4999), direction: 'credit', postedAt: '2026-10-20' }];
  const matches = [{
    status: 'confirmed',
    explanation: 'exact',
    links: [
      { type: 'payment', id: 'P1', role: 'capture', amountPaise: rs(4999) },
      { type: 'bank', id: 'B1', role: 'credit', amountPaise: rs(4999) },
    ],
  }];
  const lineage = buildLineage({ order, payments, bank, matches });
  assert.match(lineage.breakNote, /still marked unpaid/);
  assert.equal(lineage.stages.find((stage) => stage.id === 'bank').status, 'verified');

  const missing = buildLineage({
    order: { ...order, orderId: '1070', status: 'paid' },
    payments: [{ ...payments[0], orderId: '1070' }],
    bank: [],
    matches: [],
  });
  assert.match(missing.breakNote, /breaks before the bank/);
});
