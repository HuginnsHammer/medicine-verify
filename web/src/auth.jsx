import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { api, getStoredActor, clearSession } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [actor, setActor] = useState(() => getStoredActor());

  const login = useCallback(async (username) => {
    const res = await api.login(username);
    setActor(res.actor);
    return res.actor;
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setActor(null);
  }, []);

  const value = useMemo(() => ({ actor, login, logout }), [actor, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
