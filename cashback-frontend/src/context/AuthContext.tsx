import React, { createContext, useContext, useState, useEffect } from "react";

const API_URL = "http://localhost:3001";

interface User {
  id: number;
  email: string;
  name: string;
  avatar_url?: string | null;
  balance?: number;
  email_verified?: boolean;
}

export interface RegisterResult {
  message?: string;
  verification_email_sent?: boolean;
  preview_url?: string | null;
}

export interface ResendResult {
  message?: string;
  preview_url?: string | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  isEmailVerificationPending: boolean;
  login: (data: { email: string; password: string }) => Promise<void>;
  register: (data: { name: string; email: string; password: string }) => Promise<RegisterResult>;
  verifyEmail: (token: string) => Promise<void>;
  resendVerification: (email: string) => Promise<ResendResult>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

function parseError(text: string, fallback: string): string {
  try {
    const parsed = JSON.parse(text);
    const message = parsed?.message;
    if (Array.isArray(message)) return message.join(", ");
    if (typeof message === "string") return message;
  } catch {
    // not JSON
  }
  return text || fallback;
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEmailVerificationPending, setIsEmailVerificationPending] = useState(false);

  useEffect(() => {
    const restoreSession = async () => {
      const savedToken = localStorage.getItem("cashback_token");

      if (!savedToken) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_URL}/auth/profile`, {
          headers: { Authorization: `Bearer ${savedToken}` },
        });

        if (!response.ok) {
          throw new Error("Invalid token");
        }

        const userData = await response.json();
        
        // Проверяем, подтверждена ли почта
        if (!userData.email_verified) {
          // Почта не подтверждена — не восстанавливаем сессию
          localStorage.removeItem("cashback_token");
          setLoading(false);
          return;
        }

        setUser(userData);
        setToken(savedToken);
      } catch (error) {
        console.error("Failed to restore session:", error);
        localStorage.removeItem("cashback_token");
        setUser(null);
        setToken(null);
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, []);

  const applySessionTemporary = (newToken: string, newUser: User) => {
    // Сохраняем в памяти, но НЕ в localStorage — до подтверждения почты
    setToken(newToken);
    setUser(newUser);
    setIsEmailVerificationPending(!newUser.email_verified);
  };

  const applySessionPersistent = (newToken: string, newUser: User) => {
    // Сохраняем в localStorage — только после подтверждения почты
    localStorage.setItem("cashback_token", newToken);
    setToken(newToken);
    setUser(newUser);
    setIsEmailVerificationPending(false);
  };

  const login = async (data: { email: string; password: string }) => {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const text = await response.text();

    if (!response.ok) {
      throw new Error(parseError(text, "Login failed"));
    }

    const result = JSON.parse(text);
    applySessionPersistent(result.access_token, result.user);
  };

  const register = async (data: {
    name: string;
    email: string;
    password: string;
  }): Promise<RegisterResult> => {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const text = await response.text();

    if (!response.ok) {
      throw new Error(parseError(text, "Registration failed"));
    }

    const result = JSON.parse(text);
    // Сохраняем во временной памяти — в localStorage не добавляем
    applySessionTemporary(result.access_token, result.user);

    return {
      message: result.message,
      verification_email_sent: result.verification_email_sent,
      preview_url: result.preview_url,
    };
  };

  const verifyEmail = async (verificationToken: string) => {
    const response = await fetch(
      `${API_URL}/auth/verify-email?token=${encodeURIComponent(verificationToken)}`
    );

    const text = await response.text();

    if (!response.ok) {
      throw new Error(parseError(text, "Email verification failed"));
    }

    const result = JSON.parse(text);
    // Теперь сохраняем в localStorage — почта подтверждена
    applySessionPersistent(result.access_token, result.user);
  };

  const resendVerification = async (email: string): Promise<ResendResult> => {
    const response = await fetch(`${API_URL}/auth/resend-verification`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const text = await response.text();

    if (!response.ok) {
      throw new Error(parseError(text, "Could not resend email"));
    }

    return JSON.parse(text);
  };

  const logout = () => {
    localStorage.removeItem("cashback_token");
    setToken(null);
    setUser(null);
    setIsEmailVerificationPending(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isEmailVerificationPending,
        login,
        register,
        verifyEmail,
        resendVerification,
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