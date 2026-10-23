import { useState } from 'react';
import { api } from '../api';
import { useSession } from '../session';

export default function AuthPage() {
  const { enter } = useSession();
  const [mode, setMode] = useState('login');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    const form = new FormData(event.target);
    const body = {
      name: form.get('name'),
      email: form.get('email'),
      password: form.get('password'),
      storeName: form.get('storeName'),
      city: form.get('city'),
      withSample: form.get('withSample') === 'on',
    };
    try {
      const data = await api(mode === 'login' ? '/api/auth/login' : '/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      await enter(data, body.storeName);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-line bg-card p-6 shadow-sm">
        <p className="font-serif text-3xl">LedgerLoop</p>
        <p className="mt-2 text-sm text-mist">Sign in to open a store, or create an account and start another set of books.</p>
        <div className="mt-5 flex gap-2">
          {[['login', 'Sign in'], ['signup', 'Create account']].map(([id, label]) => (
            <button key={id} type="button" onClick={() => { setMode(id); setError(''); }} className={`rounded-full px-3 py-1.5 text-sm ${mode === id ? 'bg-ink text-paper' : 'border border-line'}`}>
              {label}
            </button>
          ))}
        </div>
        <form className="mt-5 space-y-3" onSubmit={onSubmit}>
          {mode === 'signup' && (
            <label className="block text-sm">Your name
              <input name="name" required className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2" />
            </label>
          )}
          <label className="block text-sm">Email
            <input name="email" type="email" required className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2" />
          </label>
          <label className="block text-sm">Password
            <input name="password" type="password" required minLength={mode === 'signup' ? 8 : undefined} className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2" />
          </label>
          {mode === 'signup' && (
            <>
              <label className="block text-sm">Store name
                <input name="storeName" required placeholder="Nila Studio" className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2" />
              </label>
              <label className="block text-sm">City
                <input name="city" placeholder="Kolkata" className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2" />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input name="withSample" type="checkbox" defaultChecked />
                Load the Nila Studio sample books into this store
              </label>
            </>
          )}
          {error && <p className="text-sm text-clay">{error}</p>}
          <button type="submit" disabled={busy} className="rounded-full bg-moss px-4 py-2 text-sm text-white">
            {busy ? 'Please wait…' : (mode === 'login' ? 'Sign in' : 'Create account')}
          </button>
        </form>
      </div>
    </div>
  );
}
