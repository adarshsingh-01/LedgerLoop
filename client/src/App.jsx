import { useState } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import { api } from './api';
import AuthPage from './pages/Auth.jsx';
import ImportPage from './pages/Import.jsx';
import Inbox from './pages/Inbox.jsx';
import Leakage from './pages/Leakage.jsx';
import Lineage from './pages/Lineage.jsx';
import Match from './pages/Match.jsx';
import Overview from './pages/Overview.jsx';
import { useSession } from './session';

const links = [
  ['/', 'Overview'],
  ['/match', 'SmartMatch'],
  ['/inbox', 'Inbox'],
  ['/lineage', 'Lineage'],
  ['/leakage', 'Leakage'],
  ['/import', 'Import'],
];

export default function App() {
  const { session, choose, addStore, logout } = useSession();
  const [adding, setAdding] = useState(false);
  const [storeError, setStoreError] = useState('');

  if (session === undefined) {
    return <p className="p-8 text-mist">Opening the books…</p>;
  }
  if (!session) return <AuthPage />;

  const store = session.store;

  async function resetBooks() {
    if (!window.confirm(`Reload the sample books in ${store?.name || 'this store'}? Decisions in this store will be replaced.`)) return;
    await api('/api/reset', { method: 'POST' });
    window.location.reload();
  }

  async function onAddStore(event) {
    event.preventDefault();
    setStoreError('');
    const form = new FormData(event.target);
    try {
      await addStore({
        name: form.get('name'),
        city: form.get('city'),
        withSample: form.get('withSample') === 'on',
      });
      setAdding(false);
      event.target.reset();
    } catch (error) {
      setStoreError(error.message);
    }
  }

  return (
    <div className="min-h-screen md:grid md:grid-cols-[220px_1fr]">
      <aside className="bg-ink text-[#f6f1e6] md:min-h-screen">
        <div className="px-4 py-4 md:px-5 md:py-6">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-full border border-[#e7c27a] text-lg text-[#e7c27a]">↺</span>
            <div>
              <p className="font-serif text-xl leading-none">LedgerLoop</p>
              <p className="mt-1 text-xs text-[#c9c0b2]">{session.user.name}</p>
            </div>
          </div>
          <label className="mt-4 block text-xs text-[#c9c0b2]">Store
            <select
              className="mt-1 w-full rounded-xl bg-white px-2 py-2 text-sm text-ink"
              value={store?._id || ''}
              onChange={(event) => choose(event.target.value)}
            >
              {session.stores.map((item) => (
                <option key={item._id} value={item._id}>{item.name}</option>
              ))}
            </select>
          </label>
          <div className="mt-2 flex gap-3">
            <button type="button" onClick={() => setAdding((open) => !open)} className="text-xs text-[#e7c27a] underline">
              {adding ? 'Close' : 'Add a store'}
            </button>
            <button type="button" onClick={logout} className="text-xs text-[#d9d0c3] underline md:hidden">
              Sign out
            </button>
          </div>
          {adding && (
            <form className="mt-2 space-y-2" onSubmit={onAddStore}>
              <input name="name" required placeholder="Store name" className="w-full rounded-lg px-2 py-1.5 text-sm text-ink" />
              <input name="city" placeholder="City" className="w-full rounded-lg px-2 py-1.5 text-sm text-ink" />
              <label className="flex items-center gap-2 text-xs">
                <input name="withSample" type="checkbox" defaultChecked />
                Sample books
              </label>
              {storeError && <p className="text-xs text-[#e7c27a]">{storeError}</p>}
              <button type="submit" className="rounded-full bg-[#e7c27a] px-3 py-1 text-xs text-ink">Create</button>
            </form>
          )}
        </div>
        <nav className="flex gap-1 overflow-auto px-3 pb-3 md:block md:space-y-1 md:px-3">
          {links.map(([to, label]) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => `block whitespace-nowrap rounded-full px-3 py-2 text-sm ${isActive ? 'bg-[#e7c27a] text-ink' : 'text-[#d9d0c3] hover:bg-white/5'}`}
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden px-5 py-6 text-xs leading-5 text-[#b7ad9f] md:block">
          Exact matches confirm themselves. Anything approximate waits for you.
          <button type="button" onClick={resetBooks} className="mt-4 block text-[#e7c27a] underline">
            Reload sample books
          </button>
          <button type="button" onClick={logout} className="mt-3 block text-[#d9d0c3] underline">
            Sign out
          </button>
        </div>
      </aside>
      <main>
        <Routes key={store?._id || 'none'}>
          <Route path="/" element={<Overview />} />
          <Route path="/match" element={<Match />} />
          <Route path="/inbox" element={<Inbox />} />
          <Route path="/lineage" element={<Lineage />} />
          <Route path="/lineage/:orderId" element={<Lineage />} />
          <Route path="/leakage" element={<Leakage />} />
          <Route path="/import" element={<ImportPage />} />
        </Routes>
      </main>
    </div>
  );
}
