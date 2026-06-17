"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { auth, users, type UserProfile } from "@/lib/api";

interface AuthContextValue {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithOtp: (
    phone: string,
    code: string,
  ) => Promise<{ isNewUser: boolean }>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  devLogin: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    const token = auth.getAccessToken();
    if (!token) {
      setIsLoading(false);
      return;
    }
    try {
      const profile = await users.me();
      setUser(profile);
    } catch {
      auth.clearTokens();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await auth.login({ email, password });
    setUser(data.user);
  }, []);

  const loginWithOtp = useCallback(async (phone: string, code: string) => {
    const data = await auth.verifyOtp(phone, code);
    setUser(data.user);
    return { isNewUser: data.isNewUser };
  }, []);

  const logout = useCallback(async () => {
    await auth.logout();
    setUser(null);
  }, []);

  const devLogin = useCallback(() => {
    setUser({
      id: "dev-user",
      email: "dev@aurum.local",
      phone: null,
      firstName: "Dev",
      lastName: "Investor",
      roles: ["USER"],
      kycStatus: "APPROVED",
      createdAt: new Date().toISOString(),
    });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        loginWithOtp,
        logout,
        refresh,
        devLogin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
