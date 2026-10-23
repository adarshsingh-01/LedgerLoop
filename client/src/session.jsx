import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api, rememberStore, setUnauthorized, storedStoreId } from './api';

const SessionContext = createContext(null);

export function useSession() {
  return useContext(SessionContext);
}

function pickStore(stores, preferredId) {
  return stores.find((store) => store._id === preferredId) || stores[0] || null;
}

export function SessionProvider({ children }) {
  const [session, setSession] = useState(undefined);

  async function refresh() {
    const data = await api('/api/auth/me');
    const store = pickStore(data.stores, storedStoreId());
    if (store) rememberStore(store._id);
    setSession({ ...data, store });
    return data;
  }

  useEffect(() => {
    setUnauthorized(() => setSession(null));
    refresh().catch(() => setSession(null));
  }, []);

  const value = useMemo(() => ({
    session,
    async enter(data, preferredName) {
      const store = data.stores.find((item) => item.name === preferredName) || pickStore(data.stores, storedStoreId());
      if (store) rememberStore(store._id);
      setSession({ ...data, store });
    },
    choose(id) {
      rememberStore(id);
      setSession((prev) => ({ ...prev, store: prev.stores.find((store) => store._id === id) || prev.store }));
    },
    async addStore(fields) {
      const data = await api('/api/stores', { method: 'POST', body: JSON.stringify(fields) });
      const store = data.stores.find((item) => item.name === fields.name) || data.stores.at(-1);
      if (store) rememberStore(store._id);
      setSession((prev) => ({ ...prev, stores: data.stores, store }));
    },
    async logout() {
      await api('/api/auth/logout', { method: 'POST' });
      rememberStore('');
      setSession(null);
    },
  }), [session]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
