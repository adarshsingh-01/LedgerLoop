import { useEffect, useState } from 'react';
import { api } from '../api';
import { inr } from '../format';
import { Card, Page } from '../ui';

export default function Leakage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/api/leakage').then(setData).catch((err) => setError(err.message));
  }, []);

  if (error) return <Page title="Leakage"><p className="text-clay">{error}</p></Page>;
  if (!data) return <Page title="Leakage" lede="Looking for repeated problems…" />;

  const channels = Object.entries(data.channels);

  return (
    <Page
      kicker="Leakage radar"
      title="Problems that keep coming back"
      lede="These patterns are counted from the sample books, not from a live seller. They show where the same kind of money keeps going missing."
    >
      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <p className="text-xs uppercase tracking-wide text-mist">{data.provider} fees</p>
          <p className="mt-2 font-serif text-3xl">{inr(data.fees.extraPaise)}</p>
          <p className="mt-2 text-sm text-mist">{data.fees.count} settlements charged more than the {data.contract} contract. The bank credit still matched the net, so the leak is the rate, not a missing deposit.</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-mist">Unpaid after a capture</p>
          <div className="mt-3 space-y-2">
            {channels.map(([name, row]) => (
              <div key={name}>
                <div className="flex justify-between text-sm"><span>{name}</span><span>{row.count} · {inr(row.amountPaise)}</span></div>
                <div className="mt-1 h-2 rounded-full bg-line">
                  <div className="h-2 rounded-full bg-clay" style={{ width: `${Math.min(100, row.count * 40)}%` }} />
                </div>
              </div>
            ))}
            {channels.length === 0 && <p className="text-sm text-mist">No channel is repeating this yet.</p>}
          </div>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-mist">Delayed settlements</p>
          <p className="mt-2 font-serif text-3xl">{data.delayed.length}</p>
          <p className="mt-2 text-sm text-mist">{data.delayed.map((item) => `${item.orderId} · ${inr(item.amountPaise)}`).join(', ') || 'None open.'}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-mist">Possible duplicates</p>
          <p className="mt-2 font-serif text-3xl">{data.duplicates.length}</p>
          <p className="mt-2 text-sm text-mist">{data.duplicates[0]?.summary || 'No duplicate statement lines.'}</p>
        </Card>
      </div>
    </Page>
  );
}
