import React, { createContext, useContext, useState, useEffect } from "react";

interface User {
  id: number;
  email: string;
  name: string;
  avatar_url?: string | null;
  balance?: number;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (data: { email: string; password: string }) => Promise<void>;
  register: (data: { name: string; email: string; password: string }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session on app load
  useEffect(() => {
    const restoreSession = async () => {
      const savedToken = localStorage.getItem("cashback_token");
      console.log("🔐 Restoring session...", savedToken ? "token found" : "no token");

      if (!savedToken) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch("http://localhost:3001/auth/profile", {
          headers: {
            Authorization: `Bearer ${savedToken}`,
          },
        });

        if (!response.ok) {
          throw new Error("Invalid token");
        }

        const userData = await response.json();
        console.log("✅ Session restored for user:", userData.name);
        setUser(userData);
        setToken(savedToken);
      } catch (error) {
        console.error("❌ Failed to restore session:", error);
        localStorage.removeItem("cashback_token");
        setUser(null);
        setToken(null);
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, []);

  const applySession = (newToken: string, newUser: User) => {
    console.log("💾 Saving session for user:", newUser.name);
    localStorage.setItem("cashback_token", newToken);
    setToken(newToken);
    setUser(newUser);
  };

  const login = async (data: { email: string; password: string }) => {
    console.log("🔐 Login attempt:", data.email);
    try {
      const response = await fetch("http://localhost:3001/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const text = await response.text();
      console.log("📨 Login response status:", response.status);

      if (!response.ok) {
        console.error("❌ Login failed:", text);
        throw new Error(text || "Login failed");
      }

      const result = JSON.parse(text);
      applySession(result.access_token, result.user);
      console.log("✅ Login successful");
    } catch (error) {
      console.error("❌ Login error:", error);
      throw error;
    }
  };

  const register = async (data: { name: string; email: string; password: string }) => {
    console.log("🔐 Register attempt:", data.email);
    try {
      const response = await fetch("http://localhost:3001/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const text = await response.text();
      console.log("📨 Register response status:", response.status);

      if (!response.ok) {
        console.error("❌ Register failed:", text);
        throw new Error(text || "Registration failed");
      }

      const result = JSON.parse(text);
      applySession(result.access_token, result.user);
      console.log("✅ Register successful");
    } catch (error) {
      console.error("❌ Register error:", error);
      throw error;
    }
  };

  const logout = () => {
    console.log("👋 Logging out");
    localStorage.removeItem("cashback_token");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
};
