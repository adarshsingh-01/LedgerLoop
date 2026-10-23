import { useState } from 'react';
import { api } from '../api';
import { Card, Page } from '../ui';

const sources = [
  ['orders', 'Orders', 'order_id, customer, amount, status, channel, placed_at, product'],
  ['payments', 'Payments', 'payment_id, type, provider, reference, amount, fee, order_id, customer, paid_at, settlement_id'],
  ['bank', 'Bank statement', 'bank_id, posted_at, direction, amount, narration, reference'],
];

export default function ImportPage() {
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  async function onSubmit(event, source) {
    event.preventDefault();
    setError('');
    const file = new FormData(event.target).get('file');
    if (!file || !file.name) {
      setError('Choose a CSV file.');
      return;
    }
    const body = new FormData();
    body.append('file', file);
    try {
      setResult(await api(`/api/imports/${source}`, { method: 'POST', body }));
      event.target.reset();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Page
      kicker="Import"
      title="Bring in a CSV"
      lede="Duplicate rows are skipped. A bad row is reported and the rest of the file still loads. Reconciliation runs again after each import."
    >
      {error && <p className="mb-3 text-clay">{error}</p>}
      <div className="grid gap-3 md:grid-cols-3">
        {sources.map(([source, label, columns]) => (
          <Card key={source}>
            <h2 className="font-serif text-2xl">{label}</h2>
            <p className="mt-2 text-xs leading-5 text-mist">{columns}</p>
            <a className="mt-2 inline-block text-sm text-brass" href={`/api/samples/${source}`}>Download sample</a>
            <form className="mt-3" onSubmit={(event) => onSubmit(event, source)}>
              <input name="file" type="file" accept=".csv,text/csv" className="block w-full text-sm" />
              <button type="submit" className="mt-3 rounded-full bg-ink px-4 py-2 text-sm text-paper">Import</button>
            </form>
          </Card>
        ))}
      </div>
      {result && (
        <Card className="mt-4">
          <p>{result.inserted} added, {result.skipped} duplicates skipped, {result.errors.length} bad rows.</p>
          {result.errors.map((item) => (
            <p key={`${item.line}-${item.message}`} className="mt-1 text-sm text-clay">Line {item.line}: {item.message}</p>
          ))}
        </Card>
      )}
    </Page>
  );
}
