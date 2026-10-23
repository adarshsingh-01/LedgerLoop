import { useEffect, useState } from 'react';
import { api } from '../api';
import { RULES } from '../format';
import { Card, Page, Pill } from '../ui';

const filters = [
  ['suggested', 'Needs review'],
  ['confirmed', 'Confirmed'],
  ['rejected', 'Rejected'],
];

export default function Match() {
  const [filter, setFilter] = useState('suggested');
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');

  function load(next = filter) {
    api(`/api/matches?status=${next}`).then(setRows).catch((err) => setError(err.message));
  }

  useEffect(() => { load(filter); }, [filter]);

  async function act(id, action) {
    await api(`/api/matches/${id}/${action}`, { method: 'POST' });
    load();
  }

  return (
    <Page
      kicker="SmartMatch"
      title="Why these records match"
      lede="Each card shows the evidence. Only an exact reference, or a settlement that ties out to the paisa, is confirmed without you."
    >
      <div className="mb-4 flex gap-2">
        {filters.map(([id, label]) => (
          <button key={id} type="button" onClick={() => setFilter(id)} className={`rounded-full px-3 py-1.5 text-sm ${filter === id ? 'bg-ink text-paper' : 'bg-card text-ink border border-line'}`}>
            {label}
          </button>
        ))}
      </div>
      {error && <p className="text-clay">{error}</p>}
      <div className="space-y-3">
        {rows.map((item) => (
          <Card key={item._id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Pill tone={item.autoConfirm ? 'moss' : 'brass'}>{RULES[item.rule] || item.rule}</Pill>
                <h2 className="mt-2 font-serif text-2xl">{item.title}</h2>
              </div>
              <p className="font-serif text-xl">{Math.round(item.confidence * 100)}%</p>
            </div>
            <p className="mt-3 max-w-3xl text-sm leading-6">{item.explanation}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {item.evidence.map((bit) => (
                <span key={bit.signal} className="rounded-lg bg-paper px-2 py-1 text-xs">
                  <span className="text-mist">{bit.signal}: </span>{bit.detail}
                </span>
              ))}
            </div>
            {item.status === 'suggested' && (
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={() => act(item._id, 'confirm')} className="rounded-full bg-moss px-4 py-2 text-sm text-white">Confirm</button>
                <button type="button" onClick={() => act(item._id, 'reject')} className="rounded-full border border-line px-4 py-2 text-sm">Reject</button>
              </div>
            )}
          </Card>
        ))}
        {rows.length === 0 && <p className="text-sm text-mist">No matches in this list.</p>}
      </div>
    </Page>
  );
}
