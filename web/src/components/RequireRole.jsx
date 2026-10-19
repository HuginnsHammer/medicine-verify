import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { roleHome } from '../utils.js';

export default function RequireRole({ role, children }) {
  const { actor } = useAuth();
  if (!actor) return <Navigate to="/login" replace />;
  if (actor.role !== role) return <Navigate to={roleHome(actor.role)} replace />;
  return children;
}
