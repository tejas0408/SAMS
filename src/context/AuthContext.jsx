import { createContext, useContext, useMemo, useState } from 'react';
import { apiRequest } from '../services/api.js';

const AuthContext = createContext(null);
const storageKey = 'sams_auth';

function readStoredAuth() {
  try {
    return JSON.parse(localStorage.getItem(storageKey)) || { token: null, user: null };
  } catch {
    localStorage.removeItem(storageKey);
    return { token: null, user: null };
  }
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(readStoredAuth);

  async function login({ email, password, role }) {
    const data = await apiRequest('/auth/login', {
      method: 'POST',
      body: { email, password, role }
    });

    const nextAuth = { token: data.token, user: data.user };
    localStorage.setItem(storageKey, JSON.stringify(nextAuth));
    setAuth(nextAuth);
    return nextAuth;
  }

  async function signup(payload) {
    return apiRequest('/auth/signup', {
      method: 'POST',
      body: payload
    });
  }

  function logout() {
    localStorage.removeItem(storageKey);
    setAuth({ token: null, user: null });
  }

  const value = useMemo(
    () => ({
      token: auth.token,
      user: auth.user,
      isAuthenticated: Boolean(auth.token && auth.user),
      login,
      logout,
      signup
    }),
    [auth]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}
