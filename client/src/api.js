let onUnauthorized = () => {};

export function setUnauthorized(fn) {
  onUnauthorized = fn;
}

export function storedStoreId() {
  return localStorage.getItem('ll_store') || '';
}

export function rememberStore(id) {
  if (id) localStorage.setItem('ll_store', id);
  else localStorage.removeItem('ll_store');
}

export async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const storeId = storedStoreId();
  if (storeId) headers['x-store-id'] = storeId;
  const res = await fetch(path, { ...options, headers, credentials: 'include' });
  const data = await res.json().catch(() => ({}));
  const signingIn = path.startsWith('/api/auth/login') || path.startsWith('/api/auth/signup');
  if (res.status === 401 && !signingIn) onUnauthorized();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}
