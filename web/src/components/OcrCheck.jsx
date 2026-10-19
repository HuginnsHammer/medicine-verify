
import { useState } from 'react';
import strings from '../strings.json';
import { api, USE_MOCKS } from '../api.js';

const FIELDS = [
  ['batchNo', 'Batch'],
  ['expiry', 'Expiry'],
  ['manufacturer', 'Manufacturer'],
];

// Photo check: uploads the pack photo and shows the OCR status text from strings.json.
export default function OcrCheck({ serial, product }) {
  const [file, setFile] = useState(null);
  const [mockOutcome, setMockOutcome] = useState('match');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    if (!file) return;

    setBusy(true);
    setError('');
    setResult(null);

    try {
      setResult(await api.ocr(serial, file, mockOutcome));
    } catch {
      setError('The photo could not be checked. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const key = result && result.match in strings.ocr ? result.match : 'unreadable';
  const extracted = (result && result.extracted) || {};
  const differences = result && Array.isArray(result.differences) ? result.differences : [];

  return (
    <section className="card">
      <h2>Check a photo of the pack</h2>
      <p className="muted">
        Take or choose a clear photo of the printed batch and expiry details.
      </p>

      {USE_MOCKS && (
        <p className="notice" role="note">
          Demo simulation only: the uploaded image is not analyzed. Choose a
          simulated outcome below; this is not evidence that the pack is genuine.
        </p>
      )}

      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="pack-photo">Pack photo</label>
          <input
            id="pack-photo"
            type="file"
            accept="image/*"
            onChange={(e) => {
              setFile(e.target.files && e.target.files[0] ? e.target.files[0] : null);
              setResult(null);
            }}
          />
        </div>

        {USE_MOCKS && (
          <div className="field">
            <label htmlFor="mock-outcome">Demo mode: photo result to simulate</label>
            <select
              id="mock-outcome"
              value={mockOutcome}
              onChange={(e) => setMockOutcome(e.target.value)}
            >
              <option value="match">Details match the record</option>
              <option value="mismatch">Expiry date changed</option>
              <option value="unreadable">Blurry photo</option>
            </select>
          </div>
        )}

        <button type="submit" className="btn block" disabled={!file || busy}>
          {busy ? 'Checking…' : 'Check photo'}
        </button>
      </form>

      {error && <p className="notice" role="alert">{error}</p>}

      {result && (
        <div style={{ marginTop: '1rem' }}>
          <div className={`banner ${key}`} role="status">
            {USE_MOCKS
              ? `Simulated demo result: ${strings.ocr[key]}. The image was not analyzed.`
              : strings.ocr[key]}

            {!USE_MOCKS && typeof result.confidence === 'number' && (
              <small>
                Reading confidence: {Math.round(result.confidence * 100)}%
              </small>
            )}
          </div>

          <table className="diff">
            <thead>
              <tr>
                <th>Field</th>
                <th>Registered</th>
                <th>Detected</th>
              </tr>
            </thead>
            <tbody>
              {FIELDS.map(([f, label]) => {
                const reg = product ? product[f] : '';
                const det = extracted[f] || '';
                const differs = Boolean(reg && det && reg !== det);

                return (
                  <tr key={f} className={differs ? 'differs' : undefined}>
                    <td>{label}</td>
                    <td>{reg || '—'}</td>
                    <td>{det || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {differences.length > 0 && (
            <>
              <h3 style={{ marginTop: '0.8rem' }}>Differences</h3>
              <ul className="plain">
                {differences.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  );
}
