import { NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { api } from './api';
import ImportPage from './pages/Import.jsx';
import Inbox from './pages/Inbox.jsx';
import Leakage from './pages/Leakage.jsx';
import Lineage from './pages/Lineage.jsx';
import Match from './pages/Match.jsx';
import Overview from './pages/Overview.jsx';

const links = [
  ['/', 'Overview'],
  ['/match', 'SmartMatch'],
  ['/inbox', 'Inbox'],
  ['/lineage', 'Lineage'],
  ['/leakage', 'Leakage'],
  ['/import', 'Import'],
];

export default function App() {
  const navigate = useNavigate();

  async function resetBooks() {
    if (!window.confirm('Reload the Nila Studio sample books? Your review decisions on this demo will be cleared.')) return;
    await api('/api/reset', { method: 'POST' });
    navigate('/');
    window.location.reload();
  }

  return (
    <div className="min-h-screen md:grid md:grid-cols-[220px_1fr]">
      <aside className="bg-ink text-[#f6f1e6] md:min-h-screen">
        <div className="flex items-center gap-3 px-4 py-4 md:px-5 md:py-6">
          <span className="grid h-9 w-9 place-items-center rounded-full border border-[#e7c27a] text-lg text-[#e7c27a]">↺</span>
          <div>
            <p className="font-serif text-xl leading-none">LedgerLoop</p>
            <p className="mt-1 text-xs text-[#c9c0b2]">Nila Studio</p>
          </div>
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
            Reset sample books
          </button>
        </div>
      </aside>
      <main>
        <Routes>
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
