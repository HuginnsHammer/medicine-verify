import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api'
import strings from '../strings.json'

const statusBannerClass = {
  registered: 'banner-info',
  in_custody: 'banner-info',
  dispensed: 'banner-ok',
  conflict: 'banner-danger',
  unknown: 'banner-unknown',
};

export default function PublicVerify() {
  const { serial } = useParams();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [ocrResult, setOcrResult] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.verifySerial(serial)
      .then(data => { if (!cancelled) setResult(data); })
      .catch(err => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [serial]);

  const handleOcrUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setOcrLoading(true);
    setOcrError(null);
    setOcrResult(null);
    try {
      const data = await api.verifyOcr(file, serial);
      setOcrResult(data);
    } catch (err) {
      setOcrError(err.message);
    } finally {
      setOcrLoading(false);
    }
  };

  if (loading) return <div className="container loading">Verifying…</div>;
  if (error) return <div className="container"><div className="banner banner-danger">{error}</div></div>;
  if (!result) return null;

  return (
    <div className="container">
      <h2 className="page-title">Pack Verification</h2>

      {/* Status Banner */}
      <div className={`banner ${statusBannerClass[result.status] || 'banner-unknown'}`}>
        {strings.status[result.status] || result.status}
      </div>

      {/* Serial */}
      <div className="card">
        <h3>Serial</h3>
        <p style={{ fontFamily: 'monospace', fontSize: '1rem' }}>{result.serial}</p>
      </div>

      {/* Product */}
      {result.product && (
        <div className="card">
          <h3>Product</h3>
          <p><strong>Name:</strong> {result.product.productName}</p>
          <p><strong>Batch:</strong> {result.product.batchNo}</p>
          <p><strong>Expiry:</strong> {result.product.expiry}</p>
        </div>
      )}

      {/* Current Holder */}
      {result.currentHolder && (
        <div className="card">
          <h3>Current Holder</h3>
          <p><strong>Name:</strong> {result.currentHolder.name}</p>
          <p><strong>Place:</strong> {result.currentHolder.place}</p>
        </div>
      )}

      {/* Flags */}
      {result.flags && result.flags.length > 0 && (
        <ul className="flag-list">
          {result.flags.map((flag, i) => (
            <li key={i} className="flag-item">{flag}</li>
          ))}
        </ul>
      )}

      {/* Custody Trail */}
      {result.trail && result.trail.length > 0 && (
        <div className="card">
          <h3>Custody Trail</h3>
          <ul className="trail-list">
            {result.trail.map((event, i) => (
              <li key={i} className="trail-item">
                <span className="trail-type">{event.type}</span>
                <span className="trail-details">
                  {event.actorName}{event.place ? ` — ${event.place}` : ''}
                </span>
                <span className="trail-time">{new Date(event.at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* OCR Section */}
      <div className="ocr-section">
        <h3>Photo Verification</h3>
        <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.75rem' }}>
          Upload a photo of the medicine pack to compare with the registry.
        </p>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleOcrUpload}
        />
        {ocrLoading && <p className="loading">Analyzing image…</p>}
        {ocrError && <div className="banner banner-danger">{ocrError}</div>}
        {ocrResult && (
          <div style={{ marginTop: '0.75rem' }}>
            <div className={`banner ${ocrResult.match === 'match' ? 'banner-ok' : ocrResult.match === 'mismatch' ? 'banner-danger' : 'banner-warning'}`}>
              {strings.ocr[ocrResult.match] || ocrResult.match}
            </div>
            {ocrResult.extracted && (
              <div className="card">
                <h3>Extracted Fields</h3>
                <p><strong>Batch:</strong> {ocrResult.extracted.batchNo}</p>
                <p><strong>Expiry:</strong> {ocrResult.extracted.expiry}</p>
                <p><strong>Manufacturer:</strong> {ocrResult.extracted.manufacturer}</p>
                <p><strong>Confidence:</strong> {(ocrResult.confidence * 100).toFixed(0)}%</p>
              </div>
            )}
            {ocrResult.differences && ocrResult.differences.length > 0 && (
              <div>
                <h4 style={{ marginBottom: '0.5rem' }}>Differences</h4>
                {ocrResult.differences.map((diff, i) => (
                  <div key={i} className="diff-item">{typeof diff === 'string' ? diff : JSON.stringify(diff)}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <div className="disclaimer">{strings.disclaimer}</div>
    </div>
  )
}
