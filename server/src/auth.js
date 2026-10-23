import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { STORE_DEFAULTS } from './books.js';
import { Order, Store, User } from './models.js';
import { seedBooks } from './seed.js';

const WEEK = 7 * 24 * 60 * 60;

function secret() {
  return process.env.JWT_SECRET || 'ledgerloop-dev-only';
}

function cookieFlags() {
  const secure = process.env.RENDER === 'true' || process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `HttpOnly; Path=/; SameSite=Lax${secure}`;
}

export function readCookie(req, name) {
  const raw = req.headers.cookie || '';
  const hit = raw.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : '';
}

export function setAuthCookie(res, userId) {
  const token = jwt.sign({ uid: String(userId) }, secret(), { expiresIn: WEEK });
  res.setHeader('Set-Cookie', `ll_token=${token}; Max-Age=${WEEK}; ${cookieFlags()}`);
}

export function clearAuthCookie(res) {
  res.setHeader('Set-Cookie', `ll_token=; Max-Age=0; ${cookieFlags()}`);
}

export function publicUser(user) {
  return { id: user._id, name: user.name, email: user.email };
}

export async function storesFor(userId) {
  return Store.find({ ownerId: userId }).sort({ createdAt: 1 }).lean();
}

export async function requireUser(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const bearer = header.startsWith('Bearer ') ? header.slice(7) : '';
    const token = bearer || readCookie(req, 'll_token');
    if (!token) return res.status(401).json({ error: 'Sign in to continue.' });
    const payload = jwt.verify(token, secret());
    const user = await User.findById(payload.uid).lean();
    if (!user) return res.status(401).json({ error: 'Sign in to continue.' });
    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ error: 'Sign in to continue.' });
  }
}

export async function requireStore(req, res, next) {
  const storeId = req.headers['x-store-id'];
  if (!storeId) return res.status(400).json({ error: 'Choose a store.' });
  const store = await Store.findOne({ _id: storeId, ownerId: req.user._id }).lean();
  if (!store) return res.status(404).json({ error: 'Store not found.' });
  req.store = store;
  return next();
}

export function workspaceOf(store, user) {
  return {
    name: store.name,
    city: store.city || '',
    gateway: store.gateway || STORE_DEFAULTS.gateway,
    bank: store.bankName || STORE_DEFAULTS.bankName,
    contractedFeeBps: store.contractedFeeBps || STORE_DEFAULTS.contractedFeeBps,
    operator: user.name,
  };
}

export async function registerUser({ name, email, password, storeName, city, withSample }) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanName = String(name || '').trim();
  const cleanStore = String(storeName || '').trim();
  if (!cleanName || !cleanStore) {
    const error = new Error('Name and store name are required.');
    error.status = 400;
    throw error;
  }
  if (!cleanEmail.includes('@')) {
    const error = new Error('Enter a valid email.');
    error.status = 400;
    throw error;
  }
  if (String(password || '').length < 8) {
    const error = new Error('Use a password of at least 8 characters.');
    error.status = 400;
    throw error;
  }
  if (await User.findOne({ email: cleanEmail })) {
    const error = new Error('An account with that email already exists.');
    error.status = 400;
    throw error;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ name: cleanName, email: cleanEmail, passwordHash });
  await Store.updateMany({ ownerId: null }, { ownerId: user._id });
  await openStore(user, { name: cleanStore, city, withSample });
  return user;
}

export async function openStore(user, { name, city, withSample }) {
  const cleanName = String(name || '').trim();
  if (!cleanName) {
    const error = new Error('Store name is required.');
    error.status = 400;
    throw error;
  }
  const existing = await Store.findOne({ ownerId: user._id, name: cleanName });
  if (existing) {
    if (withSample && !(await Order.countDocuments({ storeId: existing._id }))) await seedBooks(existing._id);
    return existing;
  }
  const store = await Store.create({
    name: cleanName,
    city: String(city || '').trim(),
    ownerId: user._id,
    ...STORE_DEFAULTS,
  });
  if (withSample) await seedBooks(store._id);
  return store;
}

export async function checkPassword(email, password) {
  const user = await User.findOne({ email: String(email || '').trim().toLowerCase() }).select('+passwordHash');
  if (!user) return null;
  const ok = await bcrypt.compare(String(password || ''), user.passwordHash);
  return ok ? user : null;
}
