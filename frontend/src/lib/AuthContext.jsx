import { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('yk_user');
    return raw ? JSON.parse(raw) : null;
  });

  useEffect(() => {
    if (user) localStorage.setItem('yk_user', JSON.stringify(user));
    else localStorage.removeItem('yk_user');
  }, [user]);

  async function login(phone, password) {
    const { token, user } = await api.login(phone, password);
    localStorage.setItem('yk_token', token);
    setUser(user);
    return user;
  }

  function logout() {
    localStorage.removeItem('yk_token');
    setUser(null);
  }

  return <AuthCtx.Provider value={{ user, login, logout }}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  return useContext(AuthCtx);
}
