import React, { createContext, useContext, useState, useCallback } from "react";
import { clearTokens, saveTokens } from "./api";

const AuthContext = createContext(null);

const ROLE_KEY = "ds_role";
const USER_KEY = "ds_username";

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => {
    const role     = localStorage.getItem(ROLE_KEY);
    const username = localStorage.getItem(USER_KEY);
    return role && username ? { role, username } : null;
  });

  const login = useCallback((accessToken, refreshToken, role, username) => {
    saveTokens(accessToken, refreshToken);
    localStorage.setItem(ROLE_KEY, role);
    localStorage.setItem(USER_KEY, username);
    setAuth({ role, username });
  }, []);

  const logout = useCallback(() => {
    clearTokens();
    localStorage.removeItem(ROLE_KEY);
    localStorage.removeItem(USER_KEY);
    setAuth(null);
  }, []);

  return (
    <AuthContext.Provider value={{ auth, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
