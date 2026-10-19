import strings from './strings.json';

export const ROLE_HOME = {
  manufacturer: '/manufacturer',
  distributor: '/distributor',
  pharmacy: '/pharmacy',
  regulator: '/regulator',
};

export function roleHome(role) {
  return ROLE_HOME[role] || '/login';
}

// "double_dispense" -> "Double dispense", "actorName" -> "Actor name"
export function humanize(text) {
  const s = String(text ?? '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString();
}

export function shortHash(hash) {
  if (!hash) return '—';
  const h = String(hash);
  return h.length > 18 ? `${h.slice(0, 10)}…${h.slice(-6)}` : h;
}

// A scanned QR holds ".../v/<serial>"; a typed value is used as-is.
export function extractSerial(text) {
  const raw = String(text ?? '').trim();
  if (!raw) return '';
  const m = raw.match(/\/v\/([^/?#\s]+)/);
  if (m) return decodeURIComponent(m[1]).trim();
  return raw;
}

export function normalizeSerial(text) {
  return extractSerial(text);
}

// Demo recipient shortcuts. The API has no actor-list endpoint, so ids are typed;
// these match the ids in the demo data (distributor 2, pharmacy 3).
export const RECIPIENT_PRESETS = {
  distributor: { id: 2, label: 'Distributor (id 2)' },
  pharmacy: { id: 3, label: 'Pharmacy (id 3)' },
};

export function statusText(status) {
  return strings.status[status] || strings.status.unknown;
}

export function qrValue(serial) {
  return window.location.origin + '/v/' + serial;
}
