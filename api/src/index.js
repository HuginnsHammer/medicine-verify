const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const path = require('path');
const integrations = require('./integrations');
const multer = require('multer');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 }
});

const app = express();
app.use(cors());
app.use(express.json());

const dbPath = process.env.DB_FILE || path.join(__dirname, '../data/demo.db');
const db = new Database(dbPath);

const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'unauthorized', message: 'Missing or invalid token' });
  }
  const token = authHeader.substring(7);
  const actor = db.prepare('SELECT * FROM actors WHERE token = ?').get(token);
  if (!actor) {
    return res.status(401).json({ error: 'unauthorized', message: 'Missing or invalid token' });
  }
  req.actor = actor;
  next();
};

app.post('/api/login', (req, res) => {
  const { username } = req.body;
  if (!username) {
    return res.status(401).json({ error: 'unauthorized', message: 'Unknown user' });
  }

  const actor = db.prepare('SELECT * FROM actors WHERE username = ?').get(username);
  
  if (!actor) {
    return res.status(401).json({ error: 'unauthorized', message: 'Unknown user' });
  }

  const token = crypto.randomUUID();
  db.prepare('UPDATE actors SET token = ? WHERE id = ?').run(token, actor.id);
  
  res.status(200).json({
    token,
    actor: {
      id: actor.id,
      role: actor.role,
      name: actor.name,
      place: actor.place
    }
  });
});

function generateSerial() {
  const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  const bytes = crypto.randomBytes(16);
  let serial = '';
  for (let i = 0; i < 16; i++) {
    serial += alphabet[bytes[i] % alphabet.length];
  }
  return serial;
}

app.post('/api/batches', requireAuth, async (req, res) => {
  if (req.actor.role !== 'manufacturer') {
    return res.status(403).json({ error: 'forbidden', message: 'Only manufacturers can register batches' });
  }

  const { productName, batchNo, expiry, quantity } = req.body;
  if (!productName || !batchNo || !expiry || !quantity) {
    return res.status(400).json({ error: 'bad_request', message: 'Missing fields' });
  }
  
  const serials = [];
  for (let i = 0; i < quantity; i++) {
    serials.push(generateSerial());
  }

  const now = new Date().toISOString();
  let batchId;

  const insertBatch = db.prepare(`INSERT INTO batches (productName, batchNo, expiry, quantity) VALUES (?, ?, ?, ?)`);
  const insertPack = db.prepare(`INSERT INTO packs (serial, batchId, status, currentHolderId) VALUES (?, ?, ?, ?)`);
  const insertEvent = db.prepare(`INSERT INTO events (packSerial, type, actorId, at, txHash) VALUES (?, ?, ?, ?, ?)`);
  const updateEventTx = db.prepare(`UPDATE events SET txHash = ? WHERE packSerial = ? AND type = 'registered'`);

  const registerTransaction = db.transaction(() => {
    const info = insertBatch.run(productName, batchNo, expiry, quantity);
    batchId = info.lastInsertRowid;

    for (const serial of serials) {
      insertPack.run(serial, batchId, 'registered', req.actor.id);
      insertEvent.run(serial, 'registered', req.actor.id, now, null);
    }
  });

  registerTransaction();

  try {
    const { txHash } = await integrations.chain.registerPacks(batchId, serials, req.actor.address);
    if (txHash) {
      const updateHashTransaction = db.transaction(() => {
        for (const serial of serials) {
          updateEventTx.run(txHash, serial);
        }
      });
      updateHashTransaction();
    }
  } catch (err) {
    // Chain integration failed, but DB transaction succeeded
    console.error('Chain integration failed:', err);
  }

  res.status(201).json({ batchId, serials });
});

app.post('/api/custody/transfer', requireAuth, async (req, res) => {
  const { serials, toActorId } = req.body;
  if (!Array.isArray(serials) || !toActorId) {
    return res.status(400).json({ error: 'bad_request', message: 'Missing serials or toActorId' });
  }

  const recipient = db.prepare('SELECT * FROM actors WHERE id = ?').get(toActorId);
  if (!recipient || (recipient.role !== 'distributor' && recipient.role !== 'pharmacy')) {
    return res.status(400).json({ error: 'bad_request', message: 'Invalid recipient' });
  }

  const getPack = db.prepare('SELECT * FROM packs WHERE serial = ?');
  
  for (const serial of serials) {
    const pack = getPack.get(serial);
    if (!pack) {
      return res.status(404).json({ error: 'unknown_serial', message: 'Serial not found' });
    }
    if (pack.currentHolderId !== req.actor.id) {
      return res.status(403).json({ error: 'forbidden', message: 'You do not hold this serial' });
    }
  }

  const now = new Date().toISOString();
  const updatePack = db.prepare(`UPDATE packs SET currentHolderId = ?, status = 'in_custody' WHERE serial = ?`);
  const insertEvent = db.prepare(`INSERT INTO events (packSerial, type, actorId, at, details) VALUES (?, 'transferred', ?, ?, ?)`);

  const tx = db.transaction(() => {
    for (const serial of serials) {
      updatePack.run(toActorId, serial);
      insertEvent.run(serial, req.actor.id, now, JSON.stringify({ to: toActorId }));
    }
  });

  try {
    tx();
  } catch (err) {
    return res.status(500).json({ error: 'server_error', message: 'Database error' });
  }

  const txHashes = [];
  try {
    for (const serial of serials) {
      const { txHash } = await integrations.chain.transfer(serial, req.actor.address, recipient.address);
      if (txHash) {
        txHashes.push(txHash);
        db.prepare(`UPDATE events SET txHash = ? WHERE packSerial = ? AND type = 'transferred' AND at = ?`).run(txHash, serial, now);
      }
    }
  } catch (err) {
    console.error('Chain integration failed:', err);
  }

  return res.status(200).json({ ok: true, transferred: serials.length, txHashes });
});

app.post('/api/dispense', requireAuth, async (req, res) => {
  if (req.actor.role !== 'pharmacy') {
    return res.status(403).json({ error: 'forbidden', message: 'Only pharmacies can dispense' });
  }

  const { serial } = req.body;
  if (!serial) {
    return res.status(400).json({ error: 'bad_request', message: 'Missing serial' });
  }

  const now = new Date().toISOString();
  const pack = db.prepare('SELECT * FROM packs WHERE serial = ?').get(serial);
  
  if (!pack) {
    db.prepare(`INSERT INTO alerts (serial, type, at) VALUES (?, 'unknown_serial', ?)`).run(serial, now);
    return res.status(404).json({ error: 'unknown_serial', message: 'No registered record found' });
  }

  const flags = [];
  if (pack.currentHolderId !== req.actor.id) {
    flags.push("No custody record before dispensing");
  }

  const dispensedEvent = db.prepare(`SELECT * FROM events WHERE packSerial = ? AND type = 'dispensed'`).get(serial);

  if (dispensedEvent) {
    const conflictTx = db.transaction(() => {
      db.prepare(`INSERT INTO events (packSerial, type, actorId, at) VALUES (?, 'conflict', ?, ?)`).run(serial, req.actor.id, now);
      db.prepare(`INSERT INTO alerts (serial, type, at) VALUES (?, 'double_dispense', ?)`).run(serial, now);
    });
    conflictTx();
    
    const firstActor = db.prepare(`SELECT name FROM actors WHERE id = ?`).get(dispensedEvent.actorId);
    
    let txHash = null;
    try {
      const result = await integrations.chain.dispense(serial, req.actor.address);
      txHash = result.txHash;
      if (txHash) {
         db.prepare(`UPDATE events SET txHash = ? WHERE packSerial = ? AND type = 'conflict' AND at = ?`).run(txHash, serial, now);
      }
    } catch (err) {
      console.error(err);
    }
    
    return res.status(200).json({
      result: 'conflict',
      txHash,
      flags,
      conflictWith: {
        actorName: firstActor ? firstActor.name : 'Unknown',
        at: dispensedEvent.at
      }
    });
  }

  const okTx = db.transaction(() => {
    db.prepare(`UPDATE packs SET status = 'dispensed' WHERE serial = ?`).run(serial);
    db.prepare(`INSERT INTO events (packSerial, type, actorId, at) VALUES (?, 'dispensed', ?, ?)`).run(serial, req.actor.id, now);
  });
  okTx();
  
  let txHash = null;
  try {
    const result = await integrations.chain.dispense(serial, req.actor.address);
    txHash = result.txHash;
    if (txHash) {
      db.prepare(`UPDATE events SET txHash = ? WHERE packSerial = ? AND type = 'dispensed' AND at = ?`).run(txHash, serial, now);
    }
  } catch (err) {
    console.error(err);
  }

  return res.status(200).json({ result: 'ok', txHash, flags });
});

app.get('/api/verify/:serial', (req, res) => {
  const { serial } = req.params;
  const pack = db.prepare('SELECT * FROM packs WHERE serial = ?').get(serial);

  if (!pack) {
    return res.status(200).json({ 
      serial, 
      status: "unknown", 
      product: null, 
      currentHolder: null, 
      trail: [], 
      flags: [] 
    });
  }

  const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(pack.batchId);
  const holder = db.prepare('SELECT name, place FROM actors WHERE id = ?').get(pack.currentHolderId);
  
  const events = db.prepare(`
    SELECT e.type, e.at, e.txHash, a.name as actorName, a.place 
    FROM events e 
    LEFT JOIN actors a ON e.actorId = a.id 
    WHERE e.packSerial = ? 
    ORDER BY e.at ASC
  `).all(serial);

  const trail = events.map(e => ({ 
    type: e.type, 
    actorName: e.actorName, 
    place: e.place, 
    at: e.at, 
    txHash: e.txHash 
  }));

  const alerts = db.prepare('SELECT * FROM alerts WHERE serial = ?').all(serial);
  
  const flags = [];
  if (alerts.some(a => a.type === 'ocr_mismatch')) {
    flags.push("Pack photo did not match the registered record");
  }
  
  let derivedStatus = 'unknown';
  if (alerts.some(a => a.type === 'double_dispense')) {
    derivedStatus = 'conflict';
  } else if (pack.status === 'dispensed') {
    derivedStatus = 'dispensed';
  } else if (pack.status === 'in_custody') {
    derivedStatus = 'in_custody';
  } else if (pack.status === 'registered') {
    derivedStatus = 'registered';
  }

  return res.status(200).json({
    serial,
    status: derivedStatus,
    product: batch ? {
      productName: batch.productName,
      batchNo: batch.batchNo,
      expiry: batch.expiry
    } : null,
    currentHolder: holder ? {
      name: holder.name,
      place: holder.place
    } : null,
    trail,
    flags
  });
});

app.post('/api/verify/ocr', upload.single('image'), async (req, res) => {
  const { serial } = req.body;

  if (!req.file) {
    return res.status(400).json({ error: 'bad_request', message: 'An image file is required' });
  }

  const pack = db.prepare('SELECT * FROM packs WHERE serial = ?').get(serial);
  if (!pack) {
    return res.status(404).json({ error: 'unknown_serial', message: 'No registered record found' });
  }

  const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(pack.batchId);

  let fields;
  try {
    fields = await integrations.ocr.extractPackFields(req.file.buffer, req.file.mimetype);
  } catch (err) {
    console.error('OCR integration failed:', err);
    return res.status(502).json({ error: 'ocr_unavailable', message: 'Image check is unavailable. Please try again.' });
  }

  let comparison;
  try {
    comparison = await integrations.ocr.comparePack(fields, batch);
  } catch (err) {
    console.error('OCR comparison failed:', err);
    return res.status(502).json({ error: 'ocr_unavailable', message: 'Image check is unavailable. Please try again.' });
  }

  const { match, differences } = comparison;

  if (match === 'mismatch') {
    try {
      db.prepare(`INSERT INTO alerts (serial, type, at) VALUES (?, 'ocr_mismatch', ?)`).run(serial, new Date().toISOString());
    } catch (err) {
      console.error('Failed to record OCR mismatch alert:', err);
    }
  }

  return res.status(200).json({
    extracted: fields,
    confidence: fields.confidence,
    match,
    differences
  });
});

app.get('/api/alerts', requireAuth, (req, res) => {
  if (req.actor.role !== 'regulator') {
    return res.status(403).json({ error: 'forbidden', message: 'Only regulators can view alerts' });
  }

  const limit = Math.min(Number(req.query.limit) || 200, 1000);
  const alerts = db.prepare(`
    SELECT id, serial, type, at, details FROM alerts
    ORDER BY at DESC, id DESC
    LIMIT ?
  `).all(limit);

  return res.status(200).json(alerts);
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? 'Image is too large. Please upload a file under 8 MB.'
      : err.message;
    return res.status(400).json({ error: 'bad_request', message });
  }
  console.error('Unhandled server error:', err);
  return res.status(500).json({ error: 'server_error', message: 'Unexpected server error' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
