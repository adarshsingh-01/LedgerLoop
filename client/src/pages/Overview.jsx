import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { inr, when } from '../format';
import { Card, Page, Pill } from '../ui';

export default function Overview() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/api/overview').then(setData).catch((err) => setError(err.message));
  }, []);

  if (error) return <Page title="Overview"><p className="text-clay">{error}</p></Page>;
  if (!data) return <Page title="Overview" lede="Reading the books…" />;

  const stats = [
    ['Orders in the books', data.counts.orders],
    ['Confirmed matches', data.counts.confirmed],
    ['Waiting for review', data.counts.review],
    ['Open discrepancy', inr(data.counts.openPaise)],
  ];

  return (
    <Page
      kicker={`${data.books.city} · ${data.books.gateway} + ${data.books.bank}`}
      title={data.books.name}
      lede="Sample books for a small clothing studio. Suggestions stay unconfirmed until a person reviews the evidence."
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(([label, value]) => (
          <Card key={label}>
            <p className="text-xs uppercase tracking-wide text-mist">{label}</p>
            <p className="mt-2 font-serif text-3xl">{value}</p>
          </Card>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-serif text-2xl">Needs a person</h2>
            <Link className="text-sm text-brass" to="/match">SmartMatch</Link>
          </div>
          <div className="space-y-3">
            {data.review.map((item) => (
              <article key={item._id} className="border-t border-line pt-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{item.title}</p>
                  <Pill tone="brass">{Math.round(item.confidence * 100)}%</Pill>
                </div>
                <p className="mt-1 text-sm text-mist">{item.explanation}</p>
              </article>
            ))}
            {data.review.length === 0 && <p className="text-sm text-mist">Nothing is waiting for review.</p>}
          </div>
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-serif text-2xl">Highest impact</h2>
            <Link className="text-sm text-brass" to="/inbox">Inbox</Link>
          </div>
          <div className="space-y-3">
            {data.exceptions.map((item) => (
              <article key={item._id} className="border-t border-line pt-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{item.title}</p>
                  <span className="font-serif">{inr(item.amountPaise)}</span>
                </div>
                <p className="mt-1 text-sm text-mist">{item.summary}</p>
              </article>
            ))}
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <h2 className="font-serif text-2xl">Audit</h2>
        <ul className="mt-3 divide-y divide-line">
          {data.audits.map((item) => (
            <li key={item._id} className="flex flex-wrap gap-x-3 py-2 text-sm">
              <span className="text-mist">{when(item.createdAt)}</span>
              <span className="font-medium">{item.actor}</span>
              <span>{item.action}</span>
              <span className="text-mist">{item.detail}</span>
            </li>
          ))}
        </ul>
      </Card>
    </Page>
  );
}
