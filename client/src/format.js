export function inr(paise) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format((paise || 0) / 100);
}

export function when(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(new Date(value));
}

export const RULES = {
  exact_reference: 'Exact reference',
  settlement_net: 'Settlement after fees',
  split_transfer: 'One transfer, two invoices',
  customer_amount: 'Customer and amount',
  instalments: 'Paid in instalments',
};
