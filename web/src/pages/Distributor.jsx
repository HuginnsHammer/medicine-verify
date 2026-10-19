import { useState } from 'react';
import Layout from '../components/Layout.jsx';
import SerialEntry from '../components/SerialEntry.jsx';
import RecipientPicker from '../components/RecipientPicker.jsx';
import { api } from '../api.js';
import { RECIPIENT_PRESETS } from '../utils.js';

export default function Distributor() {
  const [serials, setSerials] = useState([]);
  const [toActorId, setToActorId] = useState(String(RECIPIENT_PRESETS.pharmacy.id));
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  function add(s) {
    setResult(null);
    setSerials((prev) => (prev.includes(s) ? prev : [...prev, s]));
  }

  function remove(s) {
    setSerials((prev) => prev.filter((x) => x !== s));
  }

  async function transfer() {
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const res = await api.transfer({ serials, toActorId: Number(toActorId) });
      setResult(res);
      setSerials([]);
    } catch {
      setError('Transfer could not be completed. Check the serials and recipient, then try again.');
    } finally {
      setBusy(false);
    }
  }

  const validRecipient = Number.isInteger(Number(toActorId)) && Number(toActorId) > 0;

  return (
    <Layout>
      <div className="card">
        <h1>Transfer to pharmacy</h1>
        <p className="muted">Add each pack by scanning its QR code or typing the serial number.</p>
        <SerialEntry onSerial={add} submitLabel="Add serial" clearOnSubmit />
      </div>

      <div className="card">
        <h2>Serials to transfer ({serials.length})</h2>
        {serials.length === 0 ? (
          <p className="muted">None added yet.</p>
        ) : (
          <ul className="serial-list">
            {serials.map((s) => (
              <li key={s}>
                <span className="mono">{s}</span>
                <button type="button" className="chip" onClick={() => remove(s)} aria-label={`Remove ${s}`}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        <RecipientPicker
          id="pharmacy-id"
          label="Pharmacy actor ID"
          value={toActorId}
          onChange={setToActorId}
          presets={[RECIPIENT_PRESETS.pharmacy]}
        />

        {error && <p className="notice" role="alert">{error}</p>}
        <button
          type="button"
          className="btn big block"
          onClick={transfer}
          disabled={busy || serials.length === 0 || !validRecipient}
        >
          {busy ? 'Working…' : `Transfer ${serials.length || ''} serial${serials.length === 1 ? '' : 's'}`}
        </button>
      </div>

      {result && result.ok && (
        <div className="card">
          <div className="banner ok" role="status">
            Transferred {result.transferred} serial{result.transferred === 1 ? '' : 's'}
          </div>
          {Array.isArray(result.txHashes) && result.txHashes.length > 0 && (
            <ul className="plain">
              {result.txHashes.map((h, i) => (
                <li key={`${h}-${i}`} className="mono">
                  {h}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Layout>
  );
}
