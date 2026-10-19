// Recipient is entered as an actor id (the API has no actor list); presets are shortcuts.
export default function RecipientPicker({ id, label, value, onChange, presets }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="number"
        min="1"
        step="1"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {presets && presets.length > 0 && (
        <div className="chips">
          {presets.map((p) => (
            <button key={p.id} type="button" className="chip" onClick={() => onChange(String(p.id))}>
              {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
