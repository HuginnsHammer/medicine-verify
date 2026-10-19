import { useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import SerialEntry from '../components/SerialEntry.jsx';
import KeyValue from '../components/KeyValue.jsx';
import strings from '../strings.json';
import { api } from '../api.js';

export default function Pharmacy() {
  const [serial, setSerial] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  function pick(s) {
    setSerial(s);
    setResult(null);
    setError('');
  }

  async function dispense() {
    setBusy(true);
    setError('');
    setResult(null);
    try {
      setResult(await api.dispense(serial));
    } catch (e) {
      setError(
        e.status === 404
          ? strings.status.unknown
          : 'Dispense could not be completed. Check the serial and try again.'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Layout>
      <div className="card">
        <h1>Dispense a pack</h1>
        <p className="muted">Scan the QR code on the pack, or type the serial number.</p>
        <SerialEntry onSerial={pick} submitLabel="Use this serial" />
      </div>

      {serial && (
        <div className="card">
          <h2>Selected serial</h2>
          <p className="mono">{serial}</p>
          <button type="button" className="btn big block" onClick={dispense} disabled={busy}>
            {busy ? 'Working…' : 'Dispense'}
          </button>
          <p className="hint">
            <Link to={`/v/${encodeURIComponent(serial)}`}>View custody trail</Link>
          </p>
        </div>
      )}

      {error && <p className="notice" role="alert">{error}</p>}

      {result && result.result === 'ok' && (
        <div className="card">
          <div className="banner ok" role="status">
            {strings.status.dispensed}
          </div>
          <dl className="kv">
            <dt>Serial</dt>
            <dd className="mono">{serial}</dd>
            <dt>Transaction</dt>
            <dd className="mono">{result.txHash}</dd>
          </dl>
        </div>
      )}

      {result && result.result === 'conflict' && (
        <div className="card">
          <div className="banner conflict" role="alert">
            {strings.status.conflict}
            <small>This serial was already dispensed. Do not hand over the pack.</small>
          </div>
          <h3>Earlier dispense</h3>
          <KeyValue data={result.conflictWith} />
          <dl className="kv" style={{ marginTop: '0.6rem' }}>
            <dt>Transaction</dt>
            <dd className="mono">{result.txHash}</dd>
          </dl>
        </div>
      )}
    </Layout>
  );
}
