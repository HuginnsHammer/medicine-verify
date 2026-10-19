import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import StatusBanner from '../components/StatusBanner.jsx';
import Trail from '../components/Trail.jsx';
import OcrCheck from '../components/OcrCheck.jsx';
import strings from '../strings.json';
import { api } from '../api.js';
import { humanize } from '../utils.js';

export default function Verify() {
  const { serial } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError('');
    api
      .verify(serial)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch(() => {
        if (!cancelled) setError('Could not reach the registry. Check your connection and try again.');
      });
    return () => {
      cancelled = true;
    };
  }, [serial]);

  const flags = data && Array.isArray(data.flags) ? data.flags : [];

  return (
    <Layout>
      <h1>Pack check</h1>
      <p className="muted">
        Serial: <span className="mono">{serial}</span>
      </p>

      {error && <p className="notice" role="alert">{error}</p>}
      {!data && !error && <p className="muted">Checking…</p>}

      {data && (
        <>
          <StatusBanner status={data.status} />

          {data.product && (
            <section className="card">
              <h2>Product</h2>
              <dl className="kv">
                <dt>Name</dt>
                <dd>{data.product.name}</dd>
                <dt>Batch</dt>
                <dd>{data.product.batchNo}</dd>
                <dt>Expiry</dt>
                <dd>{data.product.expiry}</dd>
                <dt>Manufacturer</dt>
                <dd>{data.product.manufacturer}</dd>
              </dl>
            </section>
          )}

          {data.currentHolder && (
            <section className="card">
              <h2>Current holder</h2>
              <dl className="kv">
                <dt>Name</dt>
                <dd>{data.currentHolder.name}</dd>
                <dt>Role</dt>
                <dd>{humanize(data.currentHolder.role)}</dd>
              </dl>
            </section>
          )}

          <section className="card">
            <h2>Custody trail</h2>
            <Trail trail={data.trail} />
          </section>

          <section className="card">
            <h2>Flags</h2>
            {flags.length === 0 ? (
              <p className="muted">No flags recorded.</p>
            ) : (
              <ul className="flags">
                {flags.map((f, i) => (
                  <li key={i}>{typeof f === 'string' ? humanize(f) : JSON.stringify(f)}</li>
                ))}
              </ul>
            )}
          </section>

          <OcrCheck serial={serial} product={data.product} />
        </>
      )}

      <p className="disclaimer">{strings.disclaimer}</p>
    </Layout>
  );
}
