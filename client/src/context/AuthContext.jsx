import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api.js';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('user'));
    } catch {
      return null;
    }
  });

  // Stores the signed-in user (including the token) in state and localStorage.
  const save = (u) => {
    setUser(u);
    try {
      if (u) localStorage.setItem('user', JSON.stringify(u));
      else localStorage.removeItem('user');
    } catch { /* storage unavailable */ }
    return u;
  };

  // Pick up role changes made since the last sign-in; a deleted or suspended account is signed out.
  const token = user?.token;
  useEffect(() => {
    if (!token) return;
    api('/auth/me', { token })
      .then((me) => save({ ...me, token }))
      .catch((err) => { if (/not authorized|suspended/i.test(err.message)) save(null); });
  }, [token]);

  const login = async (email, password) =>
    save(await api('/auth/login', { method: 'POST', body: { email, password } }));
  const register = async (name, email, password) =>
    save(await api('/auth/register', { method: 'POST', body: { name, email, password } }));
  const logout = () => save(null);

  // Admins can do everything; other staff roles carry a permission list from the server.
  const can = (permission) => Boolean(user?.isAdmin || user?.permissions?.includes(permission));
  const isStaff = Boolean(user?.isAdmin || user?.permissions?.length);

  return (
    <AuthContext.Provider value={{ user, login, register, logout, setSession: save, can, isStaff }}>{children}</AuthContext.Provider>
  );
}
