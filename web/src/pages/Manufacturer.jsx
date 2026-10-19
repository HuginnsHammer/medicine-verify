import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import Layout from '../components/Layout.jsx';
import RecipientPicker from '../components/RecipientPicker.jsx';
import { api } from '../api.js';
import { RECIPIENT_PRESETS, qrValue } from '../utils.js';

const STORE_KEY = 'zentriq_batches';

function loadBatches() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export default function Manufacturer() {
  const [form, setForm] = useState({ productName: '', batchNo: '', expiry: '', quantity: '5' });
  const [batches, setBatches] = useState(loadBatches);
  const [selected, setSelected] = useState([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const [toActorId, setToActorId] = useState(String(RECIPIENT_PRESETS.distributor.id));
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);
  const [sendError, setSendError] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(batches));
    } catch {
      /* the sheet still works for this session */
    }
  }, [batches]);

  const setField = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function createBatch(e) {
    e.preventDefault();
    setCreating(true);
    setCreateError('');
    try {
      const qty = Number(form.quantity);
      const res = await api.createBatch({
        productName: form.productName.trim(),
        batchNo: form.batchNo.trim(),
        expiry: form.expiry,
        quantity: qty,
      });
      const batch = {
        batchId: res.batchId,
        productName: form.productName.trim(),
        batchNo: form.batchNo.trim(),
        expiry: form.expiry,
        serials: res.serials,
      };
      setBatches((prev) => [batch, ...prev]);
      setSelected(res.serials);
      setSendResult(null);
      setForm((f) => ({ ...f, batchNo: '' }));
    } catch {
      setCreateError('The batch could not be created. Check the details and try again.');
    } finally {
      setCreating(false);
    }
  }

  const allSerials = batches.flatMap((b) => b.serials);

  function toggle(serial) {
    setSelected((prev) => (prev.includes(serial) ? prev.filter((s) => s !== serial) : [...prev, serial]));
  }

  async function transfer() {
    setSending(true);
    setSendError('');
    setSendResult(null);
    try {
      const res = await api.transfer({ serials: selected, toActorId: Number(toActorId) });
      setSendResult(res);
    } catch {
      setSendError('Transfer could not be completed. Check the recipient and try again.');
    } finally {
      setSending(false);
    }
  }

  const validRecipient = Number.isInteger(Number(toActorId)) && Number(toActorId) > 0;
  const hasSelection = selected.length > 0;

  return (
    <Layout wide>
      <div className="card form-card">
        <h1>Register a batch</h1>
        <form onSubmit={createBatch}>
          <div className="row">
            <div className="field">
              <label htmlFor="productName">Product name</label>
              <input id="productName" type="text" value={form.productName} onChange={setField('productName')} required />
            </div>
            <div className="field">
              <label htmlFor="batchNo">Batch number</label>
              <input id="batchNo" type="text" value={form.batchNo} onChange={setField('batchNo')} required />
            </div>
          </div>
          <div className="row">
            <div className="field">
              <label htmlFor="expiry">Expiry</label>
              <input id="expiry" type="date" value={form.expiry} onChange={setField('expiry')} required />
            </div>
            <div className="field">
              <label htmlFor="quantity">Quantity</label>
              <input
                id="quantity"
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                value={form.quantity}
                onChange={setField('quantity')}
                required
              />
            </div>
          </div>
          {createError && <p className="notice" role="alert">{createError}</p>}
          <button type="submit" className="btn block" disabled={creating}>
            {creating ? 'Creating…' : 'Create batch and QR codes'}
          </button>
        </form>
      </div>

      {batches.length > 0 && (
        <div className="card">
          <div className="no-print">
            <h2>QR sheet</h2>
            <p className="muted">
              Each QR code opens the pack check page. Tick the packs to print or transfer.
              Printing uses the ticked packs, or all of them if none are ticked.
            </p>
            <div className="row" style={{ marginBottom: '0.75rem' }}>
              <button type="button" className="btn secondary" onClick={() => setSelected(allSerials)}>
                Select all
              </button>
              <button type="button" className="btn secondary" onClick={() => setSelected([])}>
                Clear selection
              </button>
              <button type="button" className="btn" onClick={() => window.print()}>
                Print QR sheet
              </button>
            </div>
            <p className="hint">{selected.length} selected</p>
          </div>

          {batches.map((b) => (
            <section key={b.batchId} style={{ marginTop: '1rem' }}>
              <h3>
                {b.productName} · batch {b.batchNo} · expiry {b.expiry}
              </h3>
              <div className="qr-grid">
                {b.serials.map((s) => {
                  const isSel = selected.includes(s);
                  const skip = hasSelection && !isSel;
                  return (
                    <div key={s} className={`qr-cell${isSel ? ' selected' : ''}${skip ? ' skip-print' : ''}`}>
                      <label className="pick">
                        <input type="checkbox" checked={isSel} onChange={() => toggle(s)} />
                        Select
                      </label>
                      <QRCodeSVG value={qrValue(s)} size={128} level="M" marginSize={2} />
                      <div className="serial">{s}</div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {batches.length > 0 && (
        <div className="card form-card">
          <h2>Transfer selected serials</h2>
          <p className="muted">{selected.length} serial{selected.length === 1 ? '' : 's'} selected.</p>
          <RecipientPicker
            id="recipient-id"
            label="Recipient actor ID"
            value={toActorId}
            onChange={setToActorId}
            presets={[RECIPIENT_PRESETS.distributor, RECIPIENT_PRESETS.pharmacy]}
          />
          {sendError && <p className="notice" role="alert">{sendError}</p>}
          <button
            type="button"
            className="btn big block"
            onClick={transfer}
            disabled={sending || selected.length === 0 || !validRecipient}
          >
            {sending ? 'Working…' : 'Transfer selected'}
          </button>
          {sendResult && sendResult.ok && (
            <div className="banner ok" role="status" style={{ marginTop: '0.75rem' }}>
              Transferred {sendResult.transferred} serial{sendResult.transferred === 1 ? '' : 's'}
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}
