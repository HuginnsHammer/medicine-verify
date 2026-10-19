import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import { api } from '../api.js';
import { formatDate, humanize } from '../utils.js';

function byNewest(a, b) {
  return new Date(b.at).getTime() - new Date(a.at).getTime();
}

export default function Regulator() {
  const [alerts, setAlerts] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const list = await api.alerts();
      setAlerts([...list].sort(byNewest));
    } catch {
      setError('Could not load alerts. Try again.');
      setAlerts((prev) => prev || []);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Layout>
      <div className="card">
        <div className="row" style={{ alignItems: 'center' }}>
          <h1 style={{ margin: 0 }}>Alerts</h1>
          <button type="button" className="btn secondary" onClick={load}>
            Refresh
          </button>
        </div>
        <p className="muted">Newest first. Open an alert to see the full custody trail.</p>
        {error && <p className="notice" role="alert">{error}</p>}
        {alerts === null && <p className="muted">Loading…</p>}
        {alerts && alerts.length === 0 && !error && <p className="muted">No alerts.</p>}
        {alerts && alerts.length > 0 && (
          <ul className="alert-list">
            {alerts.map((a) => (
              <li key={a.id}>
                <Link to={`/v/${encodeURIComponent(a.serial)}`}>
                  <b>{humanize(a.type)}</b>
                  <div className="mono">{a.serial}</div>
                  <div className="muted">{formatDate(a.at)}</div>
                  {a.details && <div>{a.details}</div>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Layout>
  );
}
