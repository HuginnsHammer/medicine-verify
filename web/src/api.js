// All network access goes through here.
// VITE_USE_MOCKS=true  -> local fixtures (src/mocks)
// VITE_USE_MOCKS=false -> relative /api/... calls (proxied to Part B by Vite)
import { mockApi } from './mocks/index.js';

export const USE_MOCKS = import.meta.env.VITE_USE_MOCKS !== 'false';

const TOKEN_KEY = 'zentriq_token';
const ACTOR_KEY = 'zentriq_actor';

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getStoredActor() {
  try {
    const raw = localStorage.getItem(ACTOR_KEY);
    return raw && getToken() ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function storeSession(token, actor) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(ACTOR_KEY, JSON.stringify(actor));
  } catch {
    /* storage unavailable: session lasts until reload */
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ACTOR_KEY);
  } catch {
    /* nothing to clear */
  }
}

async function request(path, { method = 'GET', body, form } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload;
  if (form) {
    payload = form; // browser sets the multipart boundary
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const res = await fetch(path, { method, headers, body: payload });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    // A dispense conflict may arrive with an error status; it is still a result.
    if (data && data.result === 'conflict') return data;
    throw Object.assign(new Error(`Request failed (${res.status})`), { status: res.status });
  }
  return data;
}

const ctx = () => ({ token: getToken() });

export const api = {
  async login(username) {
    const res = USE_MOCKS
      ? await mockApi.login({ username })
      : await request('/api/login', { method: 'POST', body: { username } });
    storeSession(res.token, res.actor);
    return res;
  },

  createBatch({ productName, batchNo, expiry, quantity }) {
    const body = { productName, batchNo, expiry, quantity };
    return USE_MOCKS ? mockApi.createBatch(body, ctx()) : request('/api/batches', { method: 'POST', body });
  },

  transfer({ serials, toActorId }) {
    const body = { serials, toActorId };
    return USE_MOCKS ? mockApi.transfer(body, ctx()) : request('/api/custody/transfer', { method: 'POST', body });
  },

  dispense(serial) {
    const body = { serial };
    return USE_MOCKS ? mockApi.dispense(body, ctx()) : request('/api/dispense', { method: 'POST', body });
  },

  verify(serial) {
    return USE_MOCKS ? mockApi.verify(serial) : request(`/api/verify/${encodeURIComponent(serial)}`);
  },

  // mockOutcome is only read in mock mode (the mock cannot read the image).
  ocr(serial, image, mockOutcome) {
    if (USE_MOCKS) return mockApi.ocr(serial, image, mockOutcome);
    const form = new FormData();
    form.append('serial', serial);
    form.append('image', image);
    return request('/api/verify/ocr', { method: 'POST', form });
  },

  alerts() {
    return USE_MOCKS ? mockApi.alerts() : request('/api/alerts');
  },

  // Aliases kept so components written against the Part C API surface in
  // web/src/components and web/src/pages resolve to the single canonical
  // implementation above. The endpoint path, transport and mock routing are
  // identical; only the name differs.
  registerBatch(payload) {
    return api.createBatch(payload);
  },

  transferCustody(serials, toActorId) {
    return api.transfer({ serials, toActorId });
  },

  verifySerial(serial) {
    return api.verify(serial);
  },

  verifyOcr(file, serial) {
    return api.ocr(serial, file);
  },

  getAlerts() {
    return api.alerts();
  }
};
