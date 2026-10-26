import { createContext, useContext, useState } from 'react';
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

  const save = (u) => {
    setUser(u);
    if (u) localStorage.setItem('user', JSON.stringify(u));
    else localStorage.removeItem('user');
  };

  const login = async (email, password) =>
    save(await api('/auth/login', { method: 'POST', body: { email, password } }));
  const register = async (name, email, password) =>
    save(await api('/auth/register', { method: 'POST', body: { name, email, password } }));
  const logout = () => save(null);

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>{children}</AuthContext.Provider>
  );
}
