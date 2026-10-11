import { Navigate, Route, Routes } from 'react-router-dom';
import RequireRole from './components/RequireRole.jsx';
import { useAuth } from './auth.jsx';
import { roleHome } from './utils.js';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Regulator from './pages/Regulator.jsx';
import Verify from './pages/Verify.jsx';
import Manufacturer from './pages/Manufacturer.jsx';
import Distributor from './pages/Distributor.jsx';
import Pharmacy from './pages/Pharmacy.jsx';

function Home() {
  const { actor } = useAuth();
  return <Navigate to={actor ? roleHome(actor.role) : '/login'} replace />;
}

function RequireAnyRole({ children }) {
  const { actor } = useAuth();
  if (!actor) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/v/:serial" element={<Verify />} />
      <Route
        path="/dashboard"
        element={
          <RequireAnyRole>
            <Dashboard />
          </RequireAnyRole>
        }
      />
      <Route
        path="/manufacturer"
        element={
          <RequireRole role="manufacturer">
            <Manufacturer />
          </RequireRole>
        }
      />
      <Route
        path="/distributor"
        element={
          <RequireRole role="distributor">
            <Distributor />
          </RequireRole>
        }
      />
      <Route
        path="/pharmacy"
        element={
          <RequireRole role="pharmacy">
            <Pharmacy />
          </RequireRole>
        }
      />
      <Route
        path="/regulator"
        element={
          <RequireRole role="regulator">
            <Regulator />
          </RequireRole>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
