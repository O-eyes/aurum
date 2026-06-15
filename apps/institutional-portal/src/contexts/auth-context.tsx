'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { auth, type UserProfile } from '@/lib/api';

interface AuthContextValue {
  user: UserProfile | null; isLoading: boolean; isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  devLogin: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = auth.getAccessToken();
    if (!token) { setIsLoading(false); return; }
    auth.me()
      .then(setUser)
      .catch(() => { auth.clearTokens(); setUser(null); })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await auth.login({ email, password });
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => { await auth.logout(); setUser(null); }, []);

  const refresh = useCallback(async () => {
    try { const profile = await auth.me(); setUser(profile); } catch { /* ignore */ }
  }, []);

  const devLogin = useCallback(() => {
    setUser({
      id: 'dev-inst',
      email: 'institution@aurum.local',
      firstName: 'Dev',
      lastName: 'Institution',
      roles: ['USER'],
      kycStatus: 'APPROVED',
      createdAt: new Date().toISOString(),
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated: !!user, login, logout, refresh, devLogin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
