import { formatDate, humanize, shortHash } from '../utils.js';

const LABELS = {
  registered: 'Registered',
  transfer: 'Transferred',
  transferred: 'Transferred',
  dispensed: 'Dispensed',
  conflict: 'Conflict recorded',
};

export default function Trail({ trail }) {
  if (!trail || trail.length === 0) return <p className="muted">No custody records.</p>;
  return (
    <ol className="trail">
      {trail.map((t, i) => (
        <li key={`${t.txHash || 'row'}-${i}`}>
          <div className="t-type">{LABELS[t.type] || humanize(t.type)}</div>
          <div>
            {t.actorName}
            {t.place ? `, ${t.place}` : ''}
          </div>
          <div className="muted">{formatDate(t.at)}</div>
          {t.txHash && (
            <div className="muted mono" title={t.txHash}>
              {shortHash(t.txHash)}
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}
