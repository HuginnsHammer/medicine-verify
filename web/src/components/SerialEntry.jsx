import { useState } from 'react';
import Scanner from './Scanner.jsx';
import { normalizeSerial } from '../utils.js';

// Manual serial entry (always available) plus an optional camera scan.
export default function SerialEntry({ onSerial, submitLabel = 'Use serial', clearOnSubmit = false }) {
  const [value, setValue] = useState('');

  function submit(e) {
    e.preventDefault();
    const s = normalizeSerial(value);
    if (!s) return;
    onSerial(s);
    if (clearOnSubmit) setValue('');
  }

  function scanned(text) {
    const s = normalizeSerial(text);
    if (!s) return;
    setValue(clearOnSubmit ? '' : s);
    onSerial(s);
  }

  return (
    <div>
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="serial-input">Serial number</label>
          <input
            id="serial-input"
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            placeholder="e.g. K7Q2M9XW4TBH3N8D"
          />
        </div>
        <button type="submit" className="btn block" disabled={!value.trim()}>
          {submitLabel}
        </button>
      </form>
      <Scanner onScan={scanned} />
    </div>
  );
}
