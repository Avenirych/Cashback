import React, { createContext, useContext, useState, useEffect, useRef } from "react";

export interface User {
  id: number;
  email: string;
  name: string;
  avatar_url?: string | null;
  balance?: number;
  bonusEligible: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  sessionVersion: number;
  login: (data: { email: string; password: string }) => Promise<void>;
  register: (data: { name: string; email: string; password: string }) => Promise<void>;
  refreshUser: (confirmedEligibility?: { token: string; sessionVersion: number; bonusEligible: true }) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);
export const AUTH_API = "http://localhost:3001";

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const generation = useRef(0);
  const currentToken = useRef<string | null>(null);

  useEffect(() => {
    const sessionGeneration = generation;
    const operation = ++generation.current;
    const savedToken = localStorage.getItem("cashback_token");
    if (!savedToken) {
      setLoading(false);
      return;
    }
    const restore = async () => {
      try {
        const response = await fetch(`${AUTH_API}/auth/profile`, {
          headers: { Authorization: "Bearer " + savedToken },
        });
        if (!response.ok) throw new Error("Session unavailable");
        const restoredUser = await response.json();
        if (operation !== generation.current) return;
        currentToken.current = savedToken;
        setToken(savedToken);
        setUser(restoredUser);
      } catch {
        if (operation !== generation.current) return;
        localStorage.removeItem("cashback_token");
        currentToken.current = null;
        setToken(null);
        setUser(null);
      } finally {
        if (operation === generation.current) setLoading(false);
      }
    };
    void restore();
    return () => { ++sessionGeneration.current; };
  }, []);

  const authenticate = async (path: string, data: object) => {
    const operation = ++generation.current;
    setLoading(true);
    try {
      const response = await fetch(`${AUTH_API}/auth/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Authentication failed");
      const result = await response.json();
      if (operation !== generation.current) throw new Error("Session changed");
      localStorage.setItem("cashback_token", result.access_token);
      currentToken.current = result.access_token;
      setToken(result.access_token);
      setUser(result.user);
    } finally {
      if (operation === generation.current) setLoading(false);
    }
  };

  const refreshUser = async (confirmedEligibility?: { token: string; sessionVersion: number; bonusEligible: true }) => {
    const activeToken = currentToken.current;
    if (!activeToken) throw new Error("Session unavailable");
    if (confirmedEligibility && (confirmedEligibility.token !== activeToken ||
      confirmedEligibility.sessionVersion !== generation.current)) throw new Error("Session changed");
    const operation = ++generation.current;
    const activeUser = user;
    let canUseConfirmation = true;
    try {
      const response = await fetch(`${AUTH_API}/auth/profile`, {
        headers: { Authorization: "Bearer " + activeToken },
      });
      if (!response.ok) {
        canUseConfirmation = response.status >= 500;
        throw new Error("Session unavailable");
      }
      const refreshedUser: User = await response.json();
      if (operation !== generation.current) throw new Error("Session changed");
      setUser(refreshedUser);
      return refreshedUser;
    } catch {
      if (operation !== generation.current || currentToken.current !== activeToken) {
        throw new Error("Session changed");
      }
      // A validated save already confirmed eligibility; a network-only refresh failure
      // must not misrepresent that save as failed or change another session's profile.
      if (!canUseConfirmation || !confirmedEligibility || !activeUser) throw new Error("Session unavailable");
      const confirmedUser = { ...activeUser, bonusEligible: confirmedEligibility.bonusEligible };
      setUser(confirmedUser);
      return confirmedUser;
    }
  };

  const logout = () => {
    ++generation.current;
    currentToken.current = null;
    localStorage.removeItem("cashback_token");
    setToken(null);
    setUser(null);
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{
      user, token, loading, sessionVersion: generation.current,
      login: (data) => authenticate("login", data),
      register: (data) => authenticate("register", data),
      refreshUser, logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
};
