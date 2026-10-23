import { parse } from 'csv-parse/sync';
import { rupeesToPaise } from './books.js';
import { BankTxn, Order, Payment } from './models.js';

function rowsOf(buffer) {
  return parse(buffer, { columns: true, skip_empty_lines: true, trim: true, bom: true });
}

function dateOf(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function importCsv(source, buffer) {
  const rows = rowsOf(buffer);
  const errors = [];
  let inserted = 0;
  let skipped = 0;

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const line = index + 2;
    try {
      if (source === 'orders') {
        const amountPaise = rupeesToPaise(row.amount);
        const placedAt = dateOf(row.placed_at);
        if (!row.order_id || !row.customer || amountPaise == null || !placedAt) {
          errors.push({ line, message: 'Need order_id, customer, amount and placed_at.' });
          continue;
        }
        if (await Order.findOne({ orderId: row.order_id })) { skipped += 1; continue; }
        await Order.create({
          orderId: row.order_id,
          customer: row.customer,
          amountPaise,
          status: row.status || 'paid',
          channel: row.channel || 'Website',
          product: row.product || '',
          placedAt,
        });
      } else if (source === 'payments') {
        const amountPaise = rupeesToPaise(row.amount);
        const paidAt = dateOf(row.paid_at);
        const type = row.type || 'capture';
        if (!row.payment_id || amountPaise == null || !paidAt || !['capture', 'refund', 'settlement'].includes(type)) {
          errors.push({ line, message: 'Need payment_id, type, amount and paid_at.' });
          continue;
        }
        if (await Payment.findOne({ paymentId: row.payment_id })) { skipped += 1; continue; }
        await Payment.create({
          paymentId: row.payment_id,
          type,
          provider: row.provider || 'Razorpay',
          reference: row.reference || '',
          amountPaise,
          feePaise: rupeesToPaise(row.fee) || 0,
          orderId: row.order_id || '',
          customer: row.customer || '',
          paidAt,
          settlementId: row.settlement_id || '',
        });
      } else if (source === 'bank') {
        const amountPaise = rupeesToPaise(row.amount);
        const postedAt = dateOf(row.posted_at);
        if (!row.bank_id || amountPaise == null || !postedAt || !['credit', 'debit'].includes(row.direction)) {
          errors.push({ line, message: 'Need bank_id, posted_at, direction and amount.' });
          continue;
        }
        if (await BankTxn.findOne({ bankId: row.bank_id })) { skipped += 1; continue; }
        await BankTxn.create({
          bankId: row.bank_id,
          reference: row.reference || '',
          narration: row.narration || '',
          amountPaise,
          direction: row.direction,
          postedAt,
        });
      } else {
        throw new Error('Unknown source');
      }
      inserted += 1;
    } catch (error) {
      errors.push({ line, message: error.message });
    }
  }

  return { inserted, skipped, errors, total: rows.length };
}
