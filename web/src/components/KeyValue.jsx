import { humanize } from '../utils.js';

// Generic key/value list, used for objects whose fields are not fixed (e.g. conflictWith).
export default function KeyValue({ data }) {
  const entries = Object.entries(data || {});
  if (entries.length === 0) return <p className="muted">No further details.</p>;
  return (
    <dl className="kv">
      {entries.map(([k, v]) => (
        <div key={k} style={{ display: 'contents' }}>
          <dt>{humanize(k)}</dt>
          <dd className={k.toLowerCase().includes('hash') ? 'mono' : undefined}>
            {typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
