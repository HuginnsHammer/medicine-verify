// In-browser mock of the Part B API. Persists to localStorage so the demo
// survives reloads. Response shapes match the frozen Part C API contract.
import { buildSeed, DEMO_USERNAMES, makeSerial, txHash, uuid } from './seed.js';

const DB_KEY = 'zentriq_mock_db_v1';
const DELAY_MS = 120;

function load() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* fall through to a fresh seed */
  }
  const db = buildSeed();
  save(db);
  return db;
}

function save(db) {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch {
    /* storage unavailable: mock keeps working for this call */
  }
}

export function resetMockData() {
  localStorage.removeItem(DB_KEY);
}

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

const wait = () => new Promise((r) => setTimeout(r, DELAY_MS));

function actorFor(db, token) {
  const id = db.sessions[token];
  const actor = db.actors.find((a) => a.id === id);
  if (!actor) throw httpError(401, 'Please log in again.');
  return actor;
}

function requireRole(db, token, role) {
  const actor = actorFor(db, token);
  if (actor.role !== role) throw httpError(403, 'This action is not available for your role.');
  return actor;
}

function trailEntry(type, actor) {
  return { type, actorName: actor.name, place: actor.place, at: new Date().toISOString(), txHash: txHash() };
}

function productOf(db, rec) {
  const batch = db.batches.find((b) => b.batchId === rec.batchId);
  const maker = db.actors.find((a) => a.role === 'manufacturer');
  return { name: batch.productName, batchNo: batch.batchNo, expiry: batch.expiry, manufacturer: maker.name };
}

export const mockApi = {
  async login({ username }) {
    await wait();
    const db = load();
    const key = String(username || '').trim().toLowerCase();
    const demo = DEMO_USERNAMES[key];
    if (!demo) throw httpError(401, 'Unknown username.');
    const actor = db.actors.find((a) => a.id === demo.id);
    const token = uuid();
    db.sessions[token] = actor.id;
    save(db);
    return { token, actor: { id: actor.id, role: actor.role, name: actor.name, place: actor.place } };
  },

  async createBatch({ productName, batchNo, expiry, quantity }, { token }) {
    await wait();
    const db = load();
    const actor = requireRole(db, token, 'manufacturer');
    const qty = Number(quantity);
    if (!productName || !batchNo || !expiry || !Number.isInteger(qty) || qty < 1 || qty > 500) {
      throw httpError(400, 'Check the batch details.');
    }
    const batchId = db.nextBatchId++;
    db.batches.push({ batchId, productName, batchNo, expiry });
    const serials = [];
    for (let i = 0; i < qty; i++) {
      const serial = makeSerial(db.serials);
      db.serials[serial] = {
        serial,
        batchId,
        status: 'registered',
        holderId: actor.id,
        flags: [],
        trail: [trailEntry('registered', actor)],
      };
      serials.push(serial);
    }
    save(db);
    return { batchId, serials };
  },

  async transfer({ serials, toActorId }, { token }) {
    await wait();
    const db = load();
    actorFor(db, token);
    const to = db.actors.find((a) => a.id === Number(toActorId));
    if (!to) throw httpError(404, 'Recipient not found.');
    const txHashes = [];
    for (const s of serials) {
      const rec = db.serials[s];
      if (!rec || rec.status === 'dispensed' || rec.status === 'conflict') continue;
      rec.holderId = to.id;
      rec.status = 'in_custody';
      const e = trailEntry('transferred', to);
      rec.trail.push(e);
      txHashes.push(e.txHash);
    }
    save(db);
    return { ok: true, transferred: txHashes.length, txHashes };
  },

  async dispense({ serial }, { token }) {
    await wait();
    const db = load();
    const actor = requireRole(db, token, 'pharmacy');
    const rec = db.serials[serial];
    if (!rec) throw httpError(404, 'No registered record found.');

    if (rec.status === 'dispensed' || rec.status === 'conflict') {
      const first = rec.trail.find((t) => t.type === 'dispensed');
      const e = trailEntry('conflict', actor);
      rec.trail.push(e);
      rec.status = 'conflict';
      if (!rec.flags.includes('double_dispense')) rec.flags.push('double_dispense');
      db.alerts.push({
        id: db.nextAlertId++,
        serial,
        type: 'double_dispense',
        at: e.at,
        details: `Dispensed at ${actor.name}, ${actor.place}; it had already been dispensed at ${first ? first.at : 'an earlier time'}.`,
      });
      save(db);
      const conflictWith = first
        ? { actorName: first.actorName, place: first.place, at: first.at, txHash: first.txHash }
        : {};
      return { result: 'conflict', txHash: e.txHash, conflictWith };
    }

    const e = trailEntry('dispensed', actor);
    rec.trail.push(e);
    rec.status = 'dispensed';
    rec.holderId = actor.id;
    save(db);
    return { result: 'ok', txHash: e.txHash };
  },

  async verify(serial) {
    await wait();
    const db = load();
    const rec = db.serials[serial];
    if (!rec) {
      return { serial, status: 'unknown', product: null, currentHolder: null, trail: [], flags: [] };
    }
    const holder = db.actors.find((a) => a.id === rec.holderId);
    return {
      serial,
      status: rec.status,
      product: productOf(db, rec),
      currentHolder: { id: holder.id, name: holder.name, role: holder.role },
      trail: rec.trail,
      flags: rec.flags,
    };
  },

  // The mock cannot read the photo, so the demo outcome is chosen by the caller.
  async ocr(serial, _file, outcome = 'match') {
    await wait();
    const db = load();
    const rec = db.serials[serial];
    const reg = rec ? productOf(db, rec) : null;

    if (!reg) {
      return {
        extracted: { batchNo: '', expiry: '', manufacturer: '' },
        confidence: 0.2,
        match: 'unreadable',
        differences: [],
      };
    }
    if (outcome === 'unreadable') {
      return {
        extracted: { batchNo: '', expiry: '', manufacturer: '' },
        confidence: 0.18,
        match: 'unreadable',
        differences: [],
      };
    }
    if (outcome === 'mismatch') {
      const [y, m, d] = reg.expiry.split('-');
      const changed = `${Number(y) + 1}-${m}-${d}`;
      return {
        extracted: { batchNo: reg.batchNo, expiry: changed, manufacturer: reg.manufacturer },
        confidence: 0.86,
        match: 'mismatch',
        differences: [`Expiry: registered ${reg.expiry}, detected ${changed}`],
      };
    }
    return {
      extracted: { batchNo: reg.batchNo, expiry: reg.expiry, manufacturer: reg.manufacturer },
      confidence: 0.91,
      match: 'match',
      differences: [],
    };
  },

  async alerts() {
    await wait();
    const db = load();
    return db.alerts.map((a) => ({ ...a }));
  },
};
