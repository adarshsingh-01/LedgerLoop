import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { Page } from '../ui';

const tone = {
  verified: 'border-moss bg-moss/10',
  recorded: 'border-ink/20 bg-card',
  review: 'border-brass bg-brass/10',
  missing: 'border-clay bg-clay/10',
};

export default function Lineage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [trail, setTrail] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/api/orders').then(setOrders).catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!orderId) return;
    api(`/api/lineage/${orderId}`).then(setTrail).catch((err) => setError(err.message));
  }, [orderId]);

  return (
    <Page
      kicker="Transaction lineage"
      title="Follow one order to the bank"
      lede="The highlighted stage is where the trail is incomplete or still waiting for a person."
    >
      {error && <p className="mb-3 text-clay">{error}</p>}
      <label className="text-sm">Order
        <select
          className="mt-1 w-full max-w-md rounded-xl border border-line bg-card px-3 py-2"
          value={orderId || ''}
          onChange={(e) => navigate(`/lineage/${e.target.value}`)}
        >
          <option value="">Choose an order</option>
          {orders.map((order) => (
            <option key={order.orderId} value={order.orderId}>
              {order.orderId} · {order.customer} · {order.status}
            </option>
          ))}
        </select>
      </label>

      {trail && (
        <div className="mt-6">
          {trail.breakNote && <p className="mb-4 max-w-2xl rounded-2xl border border-brass/40 bg-brass/10 p-4">{trail.breakNote}</p>}
          <ol className="space-y-3">
            {trail.stages.map((stage, index) => (
              <li key={stage.id} className="grid grid-cols-[28px_1fr] gap-3">
                <div className="flex flex-col items-center">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-ink text-xs text-paper">{index + 1}</span>
                  {index < trail.stages.length - 1 && <span className="w-px flex-1 bg-line" />}
                </div>
                <article className={`rounded-2xl border p-4 ${tone[stage.status]}`}>
                  <p className="text-xs uppercase tracking-wide text-mist">{stage.label} · {stage.status}</p>
                  <h2 className="mt-1 font-serif text-2xl">{stage.title}</h2>
                  {stage.lines.map((line) => <p key={line} className="text-sm text-mist">{line}</p>)}
                </article>
              </li>
            ))}
          </ol>
        </div>
      )}
    </Page>
  );
}
