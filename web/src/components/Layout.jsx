import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { humanize, roleHome } from '../utils.js';

export default function Layout({ children, wide = false }) {
  const { actor, logout } = useAuth();
  const navigate = useNavigate();

  function onLogout() {
    logout();
    navigate('/login');
  }

  return (
    <>
      <header className="app-header">
        <Link className="brand" to={actor ? roleHome(actor.role) : '/login'}>
          ZENTRIQ
        </Link>
        <div className="header-right">
          {actor ? (
            <>
              <span>
                {actor.name} · {humanize(actor.role)}
              </span>
              <button type="button" className="btn secondary" onClick={onLogout}>
                Log out
              </button>
            </>
          ) : (
            <Link to="/login">Staff login</Link>
          )}
        </div>
      </header>
      <main className={wide ? 'page wide' : 'page'}>{children}</main>
    </>
  );
}
