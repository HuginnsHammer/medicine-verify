import strings from '../strings.json';

// Status banner for a verify result. Text always comes from strings.json.
export default function StatusBanner({ status }) {
  const known = status in strings.status;
  const key = known ? status : 'unknown';
  return (
    <div className={`banner ${key}`} role="status">
      {strings.status[key]}
    </div>
  );
}
