import { BOOKS, inr } from './books.js';

export function followUpDraft(item, books = BOOKS) {
  const who = item.provider || books.gateway;
  if (item.kind === 'refund_without_debit') {
    return `Hello ${who} support,\n\nWe recorded a refund of ${inr(item.amountPaise)} for order ${item.orderId || '—'}. Our ${books.bank} statement has no matching debit. Please share the refund status and UTR.\n\nThank you,\n${books.name}`;
  }
  if (item.kind === 'delayed_settlement') {
    return `Hello ${who} support,\n\nOrder ${item.orderId} for ${inr(item.amountPaise)} was captured and has not appeared on our ${books.bank} statement. Please confirm the settlement batch and expected credit date.\n\nThank you,\n${books.name}`;
  }
  if (item.kind === 'fee_above_contract') {
    return `Hello ${who} support,\n\n${item.summary} Our contract is 2%. Please send the fee breakup for this settlement.\n\nThank you,\n${books.name}`;
  }
  if (item.kind === 'payment_without_invoice') {
    return `Hello,\n\nWe received ${inr(item.amountPaise)} and could not match it to an invoice. If this was your payment, please reply with the order number.\n\nThank you,\n${books.name}`;
  }
  if (item.kind === 'order_unpaid_despite_payment') {
    return `Internal note for ${item.orderId}: a payment of ${inr(item.amountPaise)} is captured. Confirm the bank line, then mark the order paid.`;
  }
  return `Please review ${item.title} Amount involved: ${inr(item.amountPaise)}.`;
}
