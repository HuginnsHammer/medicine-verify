// Seed data for mock mode. Shapes follow the frozen Part C API contract.
import strings from '../strings.json';

export function randomHex(len) {
  const bytes = new Uint8Array(Math.ceil(len / 2));
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('').slice(0, len);
}

export function txHash() {
  return '0x' + randomHex(64);
}

export function uuid() {
  const h = randomHex(32);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// 16-character serial. Re-rolls if it would spell a word from strings.forbiddenWords.
export function makeSerial(existing) {
  for (;;) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    const serial = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
    const lower = serial.toLowerCase();
    const bad = strings.forbiddenWords.some((w) => lower.includes(w));
    if (!bad && !(serial in existing)) return serial;
  }
}

const MANUFACTURER = { id: 1, role: 'manufacturer', name: 'Kilimo Pharma Ltd (demo)', place: 'Nairobi' };
const DISTRIBUTOR = { id: 2, role: 'distributor', name: 'Highland Distributors (demo)', place: 'Nakuru' };
const PHARMACY = { id: 3, role: 'pharmacy', name: 'Mlimani Pharmacy (demo)', place: 'Meru' };
const REGULATOR = { id: 4, role: 'regulator', name: 'Medicines Regulator (demo)', place: 'Nairobi' };

export const DEMO_USERNAMES = {
  kilimo: MANUFACTURER,
  highland: DISTRIBUTOR,
  mlimani: PHARMACY,
  regulator: REGULATOR,
};

function minutesAgo(m) {
  return new Date(Date.now() - m * 60000).toISOString();
}

function entry(type, actor, at) {
  return { type, actorName: actor.name, place: actor.place, at, txHash: txHash() };
}

export function buildSeed() {
  const a = 'K7Q2M9XW4TBH3N8D';
  const b = 'R4T8V2YC6DJH9PXM';

  const batches = [
    { batchId: 1, productName: 'Amoxicillin 500mg Capsules', batchNo: 'AMX-2026-014', expiry: '2027-03-31' },
  ];

  const inCustody = {
    serial: a,
    batchId: 1,
    status: 'in_custody',
    holderId: PHARMACY.id,
    flags: [],
    trail: [
      entry('registered', MANUFACTURER, minutesAgo(3000)),
      entry('transferred', DISTRIBUTOR, minutesAgo(2400)),
      entry('transferred', PHARMACY, minutesAgo(1200)),
    ],
  };

  const firstDispense = entry('dispensed', PHARMACY, minutesAgo(600));
  const secondDispense = entry('conflict', PHARMACY, minutesAgo(90));
  const conflicted = {
    serial: b,
    batchId: 1,
    status: 'conflict',
    holderId: PHARMACY.id,
    flags: ['double_dispense'],
    trail: [
      entry('registered', MANUFACTURER, minutesAgo(3000)),
      entry('transferred', DISTRIBUTOR, minutesAgo(2400)),
      entry('transferred', PHARMACY, minutesAgo(1200)),
      firstDispense,
      secondDispense,
    ],
  };

  return {
    actors: [MANUFACTURER, DISTRIBUTOR, PHARMACY, REGULATOR],
    sessions: {},
    batches,
    serials: { [a]: inCustody, [b]: conflicted },
    alerts: [
      {
        id: 1,
        serial: b,
        type: 'double_dispense',
        at: secondDispense.at,
        details: `Dispensed at ${PHARMACY.name}, ${PHARMACY.place}; it had already been dispensed at ${firstDispense.at}.`,
      },
    ],
    nextBatchId: 2,
    nextAlertId: 2,
  };
}
