import React, { createContext, useContext, useState } from "react";

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
  login: (data: { email: string; password: string }) => Promise<void>;
  register: (data: { name: string; email: string; password: string }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("cashback_token"));

  const applySession = (newToken: string, newUser: User) => {
    localStorage.setItem("cashback_token", newToken);
    setToken(newToken);
    setUser(newUser);
  };

  const login = async (data: { email: string; password: string }) => {
    console.log("🔐 Frontend: Sending login request...", data.email);
    const response = await fetch("http://localhost:3001/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const responseData = await response.text();
    console.log("📨 Frontend: Login response status:", response.status);
    console.log("📨 Frontend: Login response body:", responseData);

    if (!response.ok) {
      throw new Error(responseData || "Login failed");
    }

    const result = JSON.parse(responseData);
    applySession(result.access_token, result.user);
    console.log("✅ Frontend: Login successful");
  };

  const register = async (data: { name: string; email: string; password: string }) => {
    console.log("🔐 Frontend: Sending register request...", data.email);
    const response = await fetch("http://localhost:3001/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const responseData = await response.text();
    console.log("📨 Frontend: Register response status:", response.status);
    console.log("📨 Frontend: Register response body:", responseData);

    if (!response.ok) {
      throw new Error(responseData || "Registration failed");
    }

    const result = JSON.parse(responseData);
    applySession(result.access_token, result.user);
    console.log("✅ Frontend: Register successful");
  };

  const logout = () => {
    localStorage.removeItem("cashback_token");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
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
