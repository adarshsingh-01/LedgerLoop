export function Page({ kicker, title, lede, children }) {
  return (
    <div className="mx-auto max-w-5xl px-5 py-6 md:py-8">
      <p className="text-xs uppercase tracking-[0.16em] text-brass">{kicker}</p>
      <h1 className="mt-1 font-serif text-4xl text-ink">{title}</h1>
      {lede && <p className="mt-2 max-w-2xl text-mist">{lede}</p>}
      <div className="mt-6">{children}</div>
    </div>
  );
}

export function Card({ children, className = '' }) {
  return <section className={`rounded-2xl border border-line bg-card p-4 shadow-sm ${className}`}>{children}</section>;
}

const tones = {
  moss: 'bg-moss/10 text-moss',
  brass: 'bg-brass/15 text-brass',
  clay: 'bg-clay/10 text-clay',
  ink: 'bg-ink/5 text-ink',
};

export function Pill({ children, tone = 'ink' }) {
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}
