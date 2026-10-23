export const BOOKS = {
  name: 'Nila Studio',
  city: 'Kolkata',
  gateway: 'Razorpay',
  bank: 'HDFC Bank',
  contractedFeeBps: 200,
  operator: 'Adarsh Singh',
};

export function rupeesToPaise(value) {
  const n = Number(String(value ?? '').replace(/[,₹\s]/g, ''));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

export function inr(paise) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format((paise || 0) / 100);
}
