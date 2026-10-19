import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import { useAuth } from '../auth.jsx';
import { USE_MOCKS } from '../api.js';
import { roleHome } from '../utils.js';

export default function Login() {
  const { actor, login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (actor) return <Navigate to={roleHome(actor.role)} replace />;

  async function onSubmit(e) {
    e.preventDefault();
    const name = username.trim();
    if (!name) return;
    setBusy(true);
    setError('');
    try {
      const who = await login(name);
      navigate(roleHome(who.role), { replace: true });
    } catch {
      setError('Login failed. Check the username and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Layout>
      <div className="card">
        <h1>Staff login</h1>
        <form onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="username"
              required
            />
          </div>
          {error && <p className="notice" role="alert">{error}</p>}
          <button className="btn block" type="submit" disabled={busy || !username.trim()}>
            {busy ? 'Signing in…' : 'Log in'}
          </button>
        </form>
        {USE_MOCKS && (
          <p className="hint">
            Demo mode usernames: <b>kilimo</b> (manufacturer), <b>highland</b> (distributor),{' '}
            <b>mlimani</b> (pharmacy), <b>regulator</b>.
          </p>
        )}
      </div>
    </Layout>
  );
}
