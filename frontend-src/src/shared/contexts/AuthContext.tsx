import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import * as authService from '../services/authService';

const TOKEN_KEY = 'docvia-token';

interface AuthUser {
  id: string;
  email: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  loginWithGoogle: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const storedToken = localStorage.getItem(TOKEN_KEY);
  const [token, setToken] = useState<string | null>(storedToken);
  const [user, setUser] = useState<AuthUser | null>(null);
  // Start in loading state if there is a stored token to validate
  const [isLoading, setIsLoading] = useState(!!storedToken);

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }
    authService.getProfile(token).then((result) => {
      if (result.success && result.data) {
        setUser({ id: result.data.user.id, email: result.data.user.email });
      } else {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
      }
      setIsLoading(false);
    });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await authService.login(email, password);
    if (result.success && result.data) {
      localStorage.setItem(TOKEN_KEY, result.data.token);
      setToken(result.data.token);
      setUser({ id: result.data.user.id, email: result.data.user.email });
      return { success: true };
    }
    return { success: false, error: result.error ?? 'Login failed.' };
  }, []);

  const logout = useCallback(async () => {
    if (token) {
      await authService.logout(token).catch(() => {});
    }
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, [token]);

  const loginWithGoogle = useCallback(async () => {
    const result = await authService.getGoogleAuthUrl();
    if (result.success && result.url) {
      window.location.href = result.url;
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, token, isAuthenticated: !!token && !!user, isLoading, login, logout, loginWithGoogle }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
