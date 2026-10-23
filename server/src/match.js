import { createHash } from 'node:crypto';
import { inr } from './books.js';

const STOP = new Set([
  'upi', 'neft', 'imps', 'hdfc', 'icici', 'sbi', 'cr', 'dr', 'ref',
  'payment', 'razorpay', 'ok', 'sbin', 'oksbi', 'inb', 'from', 'the', 'and',
]);

const DAY = 86400000;

function fingerprint(parts) {
  return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 20);
}

function tokens(name) {
  return String(name || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !STOP.has(t));
}

function narrationHasCustomer(narration, customer) {
  const words = String(narration || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 3 && !STOP.has(word));
  return tokens(customer).some((token) => words.some((word) => word === token || token.startsWith(word) || word.startsWith(token)));
}

function refHit(bank, reference) {
  const ref = String(reference || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (ref.length < 6) return false;
  const blob = `${bank.reference || ''} ${bank.narration || ''}`.toLowerCase().replace(/[^a-z0-9]/g, '');
  return blob.includes(ref);
}

function ageDays(date, now) {
  return Math.max(0, (now - new Date(date)) / DAY);
}

function priority(amountPaise, occurredAt, now) {
  return Math.round((amountPaise / 100) * (1 + ageDays(occurredAt, now) / 7));
}

function evidence(signal, detail) {
  return { signal, detail };
}

function link(type, id, role, amountPaise) {
  return { type, id, role, amountPaise };
}

/**
 * Exact reference matches can confirm themselves.
 * Split payments, nicknames and instalments stay suggestions until a person confirms them.
 */
export function reconcile({ orders, payments, bank, locked = [], contractedFeeBps = 200 }, now = new Date()) {
  const lockedSet = new Set(locked);
  const matches = [];
  const exceptions = [];
  const usedBank = new Set();
  const usedPayment = new Set();

  const byKey = new Map();
  for (const row of bank) {
    if (!row.reference) continue;
    const key = `${row.reference}|${row.amountPaise}|${row.direction}`;
    const list = byKey.get(key) || [];
    list.push(row);
    byKey.set(key, list);
  }
  for (const rows of byKey.values()) {
    if (rows.length < 2) continue;
    rows.forEach((row) => usedBank.add(row.bankId));
    const row = rows[0];
    exceptions.push({
      fingerprint: fingerprint(['duplicate', row.reference, String(row.amountPaise)]),
      kind: 'possible_duplicate',
      title: 'Possible duplicate bank transaction.',
      summary: `${rows.length} statement lines share reference ${row.reference} and ${inr(row.amountPaise)}.`,
      nextStep: 'Keep one line, then check the gateway for a second charge before refunding anyone.',
      amountPaise: row.amountPaise,
      channel: '',
      provider: '',
      orderId: '',
      occurredAt: row.postedAt,
      priority: priority(row.amountPaise, row.postedAt, now),
    });
  }

  for (const payment of payments.filter((p) => p.type === 'capture' || p.type === 'refund')) {
    const direction = payment.type === 'refund' ? 'debit' : 'credit';
    const hit = bank.find((row) =>
      !usedBank.has(row.bankId)
      && row.direction === direction
      && row.amountPaise === payment.amountPaise
      && refHit(row, payment.reference));
    if (!hit) continue;
    usedBank.add(hit.bankId);
    usedPayment.add(payment.paymentId);
    matches.push({
      fingerprint: fingerprint(['exact_reference', payment.paymentId, hit.bankId]),
      rule: 'exact_reference',
      title: `${inr(payment.amountPaise)} · ${payment.customer || payment.reference}`,
      confidence: 0.99,
      autoConfirm: true,
      explanation: `Reference ${payment.reference} appears on the ${direction} of ${inr(payment.amountPaise)}. The amounts match, so this can be confirmed without a reviewer.`,
      evidence: [
        evidence('Reference', payment.reference),
        evidence('Amount', inr(payment.amountPaise)),
        evidence('Statement', hit.narration || hit.reference),
      ],
      links: [
        link('payment', payment.paymentId, payment.type, payment.amountPaise),
        link('bank', hit.bankId, direction, hit.amountPaise),
        ...(payment.orderId ? [link('order', payment.orderId, 'invoice', payment.amountPaise)] : []),
      ],
    });
  }

  const captures = payments.filter((p) => p.type === 'capture' && p.settlementId);
  const settlementIds = [...new Set(captures.map((p) => p.settlementId))];
  for (const settlementId of settlementIds) {
    const group = captures.filter((p) => p.settlementId === settlementId);
    const settlement = payments.find((p) => p.type === 'settlement' && p.reference === settlementId);
    if (!settlement) continue;
    const gross = group.reduce((sum, p) => sum + p.amountPaise, 0);
    const fees = settlement.feePaise || 0;
    const net = gross - fees;
    const hit = bank.find((row) =>
      !usedBank.has(row.bankId)
      && row.direction === 'credit'
      && row.amountPaise === settlement.amountPaise
      && refHit(row, settlement.reference));
    const expected = Math.round(gross * contractedFeeBps / 10000);
    if (fees > expected + 50) {
      const extra = fees - expected;
      exceptions.push({
        fingerprint: fingerprint(['fee', settlementId]),
        kind: 'fee_above_contract',
        title: 'Settlement fee is above the 2% contract.',
        summary: `${settlementId} charged ${inr(fees)} on ${inr(gross)}. The 2% contract would be ${inr(expected)}, so ${inr(extra)} is unexplained.`,
        nextStep: `Ask ${settlement.provider || 'the gateway'} for the fee breakup on ${settlementId}.`,
        amountPaise: extra,
        channel: '',
        provider: settlement.provider || '',
        orderId: '',
        occurredAt: settlement.paidAt,
        priority: priority(extra, settlement.paidAt, now),
      });
    }
    if (!hit || settlement.amountPaise !== net) continue;
    hit && usedBank.add(hit.bankId);
    usedPayment.add(settlement.paymentId);
    group.forEach((p) => usedPayment.add(p.paymentId));
    matches.push({
      fingerprint: fingerprint(['settlement_net', settlementId, hit.bankId]),
      rule: 'settlement_net',
      title: `${inr(net)} · ${settlementId}`,
      confidence: 0.97,
      autoConfirm: true,
      explanation: `${settlementId} is ${inr(fees)} lower than the ${inr(gross)} of orders in the batch, which matches the recorded fee. The bank credit is ${inr(hit.amountPaise)}.`,
      evidence: [
        evidence('Gross', inr(gross)),
        evidence('Fees', inr(fees)),
        evidence('Bank credit', inr(hit.amountPaise)),
        evidence('Orders', String(group.length)),
      ],
      links: [
        link('payment', settlement.paymentId, 'settlement', settlement.amountPaise),
        link('bank', hit.bankId, 'credit', hit.amountPaise),
        ...group.map((p) => link('payment', p.paymentId, 'capture', p.amountPaise)),
        ...group.map((p) => link('order', p.orderId, 'invoice', p.amountPaise)),
      ],
    });
  }

  const ordersByCustomer = new Map();
  for (const order of orders) {
    const key = String(order.customer || '').toLowerCase();
    const list = ordersByCustomer.get(key) || [];
    list.push(order);
    ordersByCustomer.set(key, list);
  }
  for (const row of bank.filter((b) => !usedBank.has(b.bankId) && b.direction === 'credit')) {
    for (const group of ordersByCustomer.values()) {
      if (group.length < 2) continue;
      if (!narrationHasCustomer(row.narration, group[0].customer)) continue;
      let pair = null;
      for (let i = 0; i < group.length; i += 1) {
        for (let j = i + 1; j < group.length; j += 1) {
          if (group[i].amountPaise + group[j].amountPaise === row.amountPaise) {
            pair = [group[i], group[j]];
            break;
          }
        }
      }
      if (!pair) continue;
      usedBank.add(row.bankId);
      matches.push({
        fingerprint: fingerprint(['split_transfer', row.bankId, pair[0].orderId, pair[1].orderId]),
        rule: 'split_transfer',
        title: `${inr(row.amountPaise)} · ${pair[0].customer} · 2 invoices`,
        confidence: 0.93,
        autoConfirm: false,
        explanation: `One bank credit of ${inr(row.amountPaise)} equals ${pair[0].orderId} (${inr(pair[0].amountPaise)}) plus ${pair[1].orderId} (${inr(pair[1].amountPaise)}). The narration names ${pair[0].customer}. This stays a suggestion until you confirm both invoices.`,
        evidence: [
          evidence('Bank credit', inr(row.amountPaise)),
          evidence(pair[0].orderId, inr(pair[0].amountPaise)),
          evidence(pair[1].orderId, inr(pair[1].amountPaise)),
          evidence('Narration', row.narration),
        ],
        links: [
          link('bank', row.bankId, 'credit', row.amountPaise),
          link('order', pair[0].orderId, 'invoice', pair[0].amountPaise),
          link('order', pair[1].orderId, 'invoice', pair[1].amountPaise),
        ],
      });
      break;
    }
  }

  for (const row of bank.filter((b) => !usedBank.has(b.bankId) && b.direction === 'credit')) {
    const candidates = payments.filter((p) =>
      p.type === 'capture'
      && !usedPayment.has(p.paymentId)
      && p.amountPaise === row.amountPaise
      && narrationHasCustomer(row.narration, p.customer));
    if (candidates.length !== 1) continue;
    const payment = candidates[0];
    usedBank.add(row.bankId);
    usedPayment.add(payment.paymentId);
    matches.push({
      fingerprint: fingerprint(['customer_amount', payment.paymentId, row.bankId]),
      rule: 'customer_amount',
      title: `${inr(payment.amountPaise)} · ${payment.customer}`,
      confidence: 0.86,
      autoConfirm: false,
      explanation: `The amounts are both ${inr(payment.amountPaise)}, and the narration mentions ${payment.customer}. The payment reference ${payment.reference} does not appear on the statement, so this is not confirmed money movement yet.`,
      evidence: [
        evidence('Amount', inr(payment.amountPaise)),
        evidence('Customer', payment.customer),
        evidence('Missing reference', payment.reference),
        evidence('Narration', row.narration),
      ],
      links: [
        link('payment', payment.paymentId, 'capture', payment.amountPaise),
        link('bank', row.bankId, 'credit', row.amountPaise),
        ...(payment.orderId ? [link('order', payment.orderId, 'invoice', payment.amountPaise)] : []),
      ],
    });
  }

  const capturesByOrder = new Map();
  for (const payment of payments.filter((p) => p.type === 'capture' && p.orderId)) {
    const list = capturesByOrder.get(payment.orderId) || [];
    list.push(payment);
    capturesByOrder.set(payment.orderId, list);
  }
  for (const [orderId, group] of capturesByOrder) {
    if (group.length < 2) continue;
    const order = orders.find((o) => o.orderId === orderId);
    if (!order) continue;
    const sum = group.reduce((total, p) => total + p.amountPaise, 0);
    if (sum !== order.amountPaise) continue;
    matches.push({
      fingerprint: fingerprint(['instalments', orderId, ...group.map((p) => p.paymentId).sort()]),
      rule: 'instalments',
      title: `${inr(order.amountPaise)} · ${order.customer} · ${group.length} payments`,
      confidence: 0.9,
      autoConfirm: false,
      explanation: `${order.orderId} looks paid in ${group.length} instalments: ${group.map((p) => inr(p.amountPaise)).join(' and ')}. Together they equal the invoice. Confirm that both credits belong to this order.`,
      evidence: group.map((p) => evidence(p.reference || p.paymentId, inr(p.amountPaise))),
      links: [
        link('order', order.orderId, 'invoice', order.amountPaise),
        ...group.map((p) => link('payment', p.paymentId, 'capture', p.amountPaise)),
      ],
    });
  }

  for (const payment of payments.filter((p) => p.type === 'refund' && !usedPayment.has(p.paymentId))) {
    exceptions.push({
      fingerprint: fingerprint(['refund', payment.paymentId]),
      kind: 'refund_without_debit',
      title: 'Refund recorded, but no bank debit was found.',
      summary: `${inr(payment.amountPaise)} was refunded${payment.orderId ? ` on ${payment.orderId}` : ''}, and no matching debit is on the statement.`,
      nextStep: 'Check the gateway refund status and look for a debit a few days after the refund date.',
      amountPaise: payment.amountPaise,
      channel: '',
      provider: payment.provider || '',
      orderId: payment.orderId || '',
      occurredAt: payment.paidAt,
      priority: priority(payment.amountPaise, payment.paidAt, now),
    });
  }

  for (const payment of payments.filter((p) => p.type === 'capture' && !p.orderId)) {
    exceptions.push({
      fingerprint: fingerprint(['orphan', payment.paymentId]),
      kind: 'payment_without_invoice',
      title: 'Payment received, but no invoice matched.',
      summary: `${inr(payment.amountPaise)} arrived with reference ${payment.reference} and no order id.`,
      nextStep: 'Search orders for this amount and customer, or ask the payer which invoice they meant.',
      amountPaise: payment.amountPaise,
      channel: '',
      provider: payment.provider || '',
      orderId: '',
      occurredAt: payment.paidAt,
      priority: priority(payment.amountPaise, payment.paidAt, now),
    });
  }

  for (const order of orders.filter((o) => o.status === 'unpaid')) {
    const payment = payments.find((p) => p.type === 'capture' && p.orderId === order.orderId);
    if (!payment) continue;
    exceptions.push({
      fingerprint: fingerprint(['unpaid', order.orderId]),
      kind: 'order_unpaid_despite_payment',
      title: 'Invoice was left unpaid after a captured payment.',
      summary: `${order.orderId} for ${order.customer} is still unpaid, but ${inr(payment.amountPaise)} was captured${payment.reference ? ` (${payment.reference})` : ''}.`,
      nextStep: 'If the bank line is real, mark the order paid. If the capture failed, leave it and note why.',
      amountPaise: order.amountPaise,
      channel: order.channel || '',
      provider: payment.provider || '',
      orderId: order.orderId,
      occurredAt: payment.paidAt,
      priority: priority(order.amountPaise, payment.paidAt, now),
    });
  }

  for (const payment of payments.filter((p) => p.type === 'capture' && p.orderId && !p.settlementId && !usedPayment.has(p.paymentId))) {
    if (ageDays(payment.paidAt, now) < 3) continue;
    exceptions.push({
      fingerprint: fingerprint(['delayed', payment.paymentId]),
      kind: 'delayed_settlement',
      title: 'Settlement has not reached the bank.',
      summary: `${inr(payment.amountPaise)} for ${payment.orderId} was captured on ${new Date(payment.paidAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} and is still missing from the statement.`,
      nextStep: 'Follow up with the gateway if this is older than the usual two-day settlement.',
      amountPaise: payment.amountPaise,
      channel: orders.find((o) => o.orderId === payment.orderId)?.channel || '',
      provider: payment.provider || '',
      orderId: payment.orderId,
      occurredAt: payment.paidAt,
      priority: priority(payment.amountPaise, payment.paidAt, now),
    });
  }

  return {
    matches: matches.filter((m) => !lockedSet.has(m.fingerprint)),
    exceptions,
  };
}

export function buildLineage({ order, payments, bank, matches }) {
  const captures = payments.filter((p) => p.type === 'capture' && p.orderId === order.orderId);
  const refunds = payments.filter((p) => p.type === 'refund' && p.orderId === order.orderId);
  const settlementIds = [...new Set(captures.map((p) => p.settlementId).filter(Boolean))];
  const settlements = payments.filter((p) => p.type === 'settlement' && settlementIds.includes(p.reference));
  const paymentIds = new Set([...captures, ...refunds, ...settlements].map((p) => p.paymentId));
  const related = matches.filter((m) => m.links.some((l) =>
    (l.type === 'order' && l.id === order.orderId) || (l.type === 'payment' && paymentIds.has(l.id))));
  const bankIds = new Set(related.flatMap((m) => m.links.filter((l) => l.type === 'bank').map((l) => l.id)));
  const banks = bank.filter((row) => bankIds.has(row.bankId));
  const confirmed = related.filter((m) => m.status === 'confirmed');
  const suggested = related.filter((m) => m.status === 'suggested');
  const bankConfirmed = confirmed.some((m) => m.links.some((l) => l.type === 'bank'));
  const bankSuggested = suggested.some((m) => m.links.some((l) => l.type === 'bank'));
  const refundDebit = confirmed.some((m) => m.links.some((l) => l.type === 'bank' && l.role === 'debit'));

  const stages = [
    {
      id: 'order',
      label: 'Order',
      status: order.status === 'paid' || order.status === 'refunded' ? 'verified' : 'recorded',
      title: `${order.orderId} · ${order.customer}`,
      lines: [`${inr(order.amountPaise)} · ${order.channel} · ${order.status}`, order.product].filter(Boolean),
    },
    {
      id: 'payment',
      label: 'Customer payment',
      status: captures.length === 0 ? 'missing' : (bankConfirmed ? 'verified' : 'recorded'),
      title: captures.length ? captures.map((p) => p.reference || p.paymentId).join(', ') : 'No capture recorded',
      lines: captures.map((p) => `${p.provider} · ${inr(p.amountPaise)}`),
    },
  ];

  const fee = [...captures, ...settlements].reduce((sum, p) => sum + (p.feePaise || 0), 0);
  if (fee > 0) {
    stages.push({
      id: 'fee',
      label: 'Gateway fee',
      status: bankConfirmed ? 'verified' : 'recorded',
      title: inr(fee),
      lines: ['Recorded on the payment or settlement'],
    });
  }

  if (refunds.length) {
    stages.push({
      id: 'refund',
      label: 'Refund',
      status: refundDebit ? 'verified' : 'missing',
      title: refunds.map((p) => inr(p.amountPaise)).join(', '),
      lines: ['Looking for a matching bank debit'],
    });
  }

  if (settlements.length) {
    stages.push({
      id: 'settlement',
      label: 'Gateway settlement',
      status: bankConfirmed ? 'verified' : 'recorded',
      title: settlements.map((p) => p.reference).join(', '),
      lines: settlements.map((p) => `Net ${inr(p.amountPaise)} after fees of ${inr(p.feePaise || 0)}`),
    });
  }

  stages.push({
    id: 'bank',
    label: 'Bank',
    status: bankConfirmed ? 'verified' : (bankSuggested ? 'review' : 'missing'),
    title: banks.length ? banks.map((row) => row.narration || row.reference).join(' · ') : 'No statement line',
    lines: banks.map((row) => `${row.direction} · ${inr(row.amountPaise)}`),
  });

  let breakNote = null;
  if (!bankConfirmed && !bankSuggested) breakNote = 'The trail breaks before the bank. No statement line is tied to this order yet.';
  else if (bankSuggested) breakNote = suggested.find((m) => m.links.some((l) => l.type === 'bank'))?.explanation || 'A bank line is only a suggestion.';
  else if (refunds.length && !refundDebit) breakNote = 'A refund is recorded, but the bank debit is missing.';
  else if (order.status === 'unpaid' && bankConfirmed) breakNote = 'The bank credit is verified, but the order is still marked unpaid.';

  return { order, stages, breakNote };
}
