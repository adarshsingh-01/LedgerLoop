import { useEffect, useState } from 'react';
import { api } from '../api';
import { inr } from '../format';
import { useSession } from '../session';
import { Card, Page, Pill } from '../ui';

const statusTone = { open: 'clay', investigating: 'brass', waiting: 'brass', resolved: 'moss' };

export default function Inbox() {
  const { session } = useSession();
  const [rows, setRows] = useState([]);
  const [current, setCurrent] = useState(null);
  const [note, setNote] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  function load() {
    api('/api/exceptions').then((items) => {
      setRows(items);
      setCurrent((prev) => items.find((item) => item._id === prev?._id) || items.find((item) => item.status !== 'resolved') || items[0] || null);
    }).catch((err) => setError(err.message));
  }

  useEffect(() => { load(); }, []);
  useEffect(() => { setNote(current?.note || ''); setCopied(false); }, [current?._id]);

  async function save(patch) {
    const updated = await api(`/api/exceptions/${current._id}`, {
      method: 'POST',
      body: JSON.stringify(patch),
    });
    setCurrent(updated);
    load();
  }

  async function markPaid() {
    await api(`/api/orders/${current.orderId}/mark-paid`, { method: 'POST' });
    load();
  }

  async function copyDraft() {
    await navigator.clipboard.writeText(current.draft);
    setCopied(true);
  }

  return (
    <Page
      kicker="Exception detective"
      title="What to check next"
      lede="Open items are ranked by amount and age. The draft is a starting point. Nothing is sent until you copy it."
    >
      {error && <p className="mb-3 text-clay">{error}</p>}
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="space-y-2">
          {rows.map((item) => (
            <button key={item._id} type="button" onClick={() => setCurrent(item)} className={`w-full rounded-2xl border p-3 text-left ${current?._id === item._id ? 'border-ink bg-card' : 'border-line bg-card/70'}`}>
              <div className="flex items-center justify-between gap-2">
                <Pill tone={statusTone[item.status]}>{item.status}</Pill>
                <span className="font-serif text-sm">{inr(item.amountPaise)}</span>
              </div>
              <p className="mt-2 text-sm font-medium">{item.title}</p>
            </button>
          ))}
        </div>
        {current && (
          <Card>
            <h2 className="font-serif text-3xl">{current.title}</h2>
            <p className="mt-3 leading-6">{current.summary}</p>
            <p className="mt-3 rounded-xl bg-paper p-3 text-sm"><span className="font-medium">Next check: </span>{current.nextStep}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-sm">Status
                <select className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2" value={current.status} onChange={(e) => save({ status: e.target.value })}>
                  <option value="open">Open</option>
                  <option value="investigating">Investigating</option>
                  <option value="waiting">Waiting on provider</option>
                  <option value="resolved">Resolved</option>
                </select>
              </label>
              <label className="text-sm">Owner
                <select className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2" value={current.owner} onChange={(e) => save({ owner: e.target.value })}>
                  <option>Unassigned</option>
                  <option>{session?.user?.name || 'Me'}</option>
                  {current.owner && current.owner !== 'Unassigned' && current.owner !== session?.user?.name && (
                    <option>{current.owner}</option>
                  )}
                </select>
              </label>
            </div>
            <label className="mt-3 block text-sm">Note
              <textarea className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2" rows="3" value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => save({ note })} className="rounded-full bg-ink px-4 py-2 text-sm text-paper">Save note</button>
              {current.kind === 'order_unpaid_despite_payment' && current.status !== 'resolved' && (
                <button type="button" onClick={markPaid} className="rounded-full bg-moss px-4 py-2 text-sm text-white">Mark order paid</button>
              )}
            </div>
            <div className="mt-5">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Follow-up draft</h3>
                <button type="button" onClick={copyDraft} className="text-sm text-brass">{copied ? 'Copied' : 'Copy'}</button>
              </div>
              <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-ink p-3 text-sm text-[#f6f1e6]">{current.draft}</pre>
            </div>
          </Card>
        )}
      </div>
    </Page>
  );
}
