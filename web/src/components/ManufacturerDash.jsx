import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { api } from '../api'

export default function ManufacturerDash({ actor }) {
  // Batch registration state
  const [batchForm, setBatchForm] = useState({ productName: '', batchNo: '', expiry: '', quantity: '' });
  const [serials, setSerials] = useState(null);
  const [batchId, setBatchId] = useState(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchError, setBatchError] = useState(null);

  // Transfer state
  const [transferSerials, setTransferSerials] = useState('');
  const [toActorId, setToActorId] = useState('');
  const [transferResult, setTransferResult] = useState(null);
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferError, setTransferError] = useState(null);

  const handleBatchChange = (e) => {
    setBatchForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleBatchSubmit = async (e) => {
    e.preventDefault();
    setBatchLoading(true);
    setBatchError(null);
    setSerials(null);
    try {
      const data = await api.registerBatch({
        ...batchForm,
        quantity: parseInt(batchForm.quantity, 10)
      });
      setBatchId(data.batchId);
      setSerials(data.serials);
    } catch (err) {
      setBatchError(err.message);
    } finally {
      setBatchLoading(false);
    }
  };

  const handleTransferSubmit = async (e) => {
    e.preventDefault();
    setTransferLoading(true);
    setTransferError(null);
    setTransferResult(null);
    try {
      const serialsArray = transferSerials
        .split(/[\n,]+/)
        .map(s => s.trim())
        .filter(Boolean);
      const data = await api.transferCustody(serialsArray, parseInt(toActorId, 10));
      setTransferResult(data);
    } catch (err) {
      setTransferError(err.message);
    } finally {
      setTransferLoading(false);
    }
  };

  return (
    <div>
      <h2 className="page-title">Manufacturer Dashboard</h2>

      {/* Form 1: Create Batch */}
      <div className="section">
        <h2>Register Batch</h2>
        <form onSubmit={handleBatchSubmit}>
          <div className="form-group">
            <label htmlFor="productName">Product Name</label>
            <input id="productName" name="productName" type="text" value={batchForm.productName}
              onChange={handleBatchChange} required />
          </div>
          <div className="form-group">
            <label htmlFor="batchNo">Batch Number</label>
            <input id="batchNo" name="batchNo" type="text" value={batchForm.batchNo}
              onChange={handleBatchChange} required />
          </div>
          <div className="form-group">
            <label htmlFor="expiry">Expiry Date</label>
            <input id="expiry" name="expiry" type="date" value={batchForm.expiry}
              onChange={handleBatchChange} required />
          </div>
          <div className="form-group">
            <label htmlFor="quantity">Quantity</label>
            <input id="quantity" name="quantity" type="number" min="1" value={batchForm.quantity}
              onChange={handleBatchChange} required />
          </div>
          <button className="btn btn-primary" type="submit" disabled={batchLoading}>
            {batchLoading ? 'Registering…' : 'Register Batch'}
          </button>
        </form>

        {batchError && <div className="banner banner-danger" style={{ marginTop: '0.75rem' }}>{batchError}</div>}

        {/* QR Print View */}
        {serials && (
          <div style={{ marginTop: '1.5rem' }}>
            <div className="banner banner-ok">
              Batch #{batchId} registered — {serials.length} serial(s) created
            </div>
            <div className="qr-grid">
              {serials.map(s => (
                <div key={s} className="qr-item">
                  <QRCodeSVG value={window.location.origin + '/v/' + s} size={150} />
                  <span>{s}</span>
                </div>
              ))}
            </div>
            <button className="btn btn-secondary" onClick={() => window.print()}>
              Print QR Codes
            </button>
          </div>
        )}
      </div>

      {/* Form 2: Transfer Custody */}
      <div className="section">
        <h2>Transfer Custody</h2>
        <form onSubmit={handleTransferSubmit}>
          <div className="form-group">
            <label htmlFor="transferSerials">Serials (one per line or comma-separated)</label>
            <textarea id="transferSerials" value={transferSerials}
              onChange={(e) => setTransferSerials(e.target.value)}
              placeholder="ABC123XYZ0000001&#10;ABC123XYZ0000002" required />
          </div>
          <div className="form-group">
            <label htmlFor="toActorId">Recipient Actor ID</label>
            <input id="toActorId" type="number" min="1" value={toActorId}
              onChange={(e) => setToActorId(e.target.value)}
              placeholder="e.g. 2 (AfyaLink)" required />
          </div>
          <button className="btn btn-primary" type="submit" disabled={transferLoading}>
            {transferLoading ? 'Transferring…' : 'Transfer'}
          </button>
        </form>

        {transferError && <div className="banner banner-danger" style={{ marginTop: '0.75rem' }}>{transferError}</div>}
        {transferResult && (
          <div className="banner banner-ok" style={{ marginTop: '0.75rem' }}>
            ✓ Transferred {transferResult.transferred} serial(s)
          </div>
        )}
      </div>
    </div>
  )
}
