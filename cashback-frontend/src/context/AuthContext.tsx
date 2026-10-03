import React, { createContext, useContext, useState } from "react";

interface User {
  email: string;
  fullName: string;
  address: string;

  forumUsername?: string;
  forumAvatar?: string;
  agreedRules?: boolean;

  initials?: string;
}

interface AuthContextType {
  user: User | null;

  login: (data: { email: string; password?: string }) => void;
  register: (data: { email: string; fullName: string; address: string }) => void;
  logout: () => void;

  updateForumProfile: (data: {
    forumUsername: string;
    forumAvatar: string | null;
    agreedRules: boolean;
  }) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);

  const login = (data: { email: string; password?: string }) => {
    setUser({
      email: data.email,
      fullName: "Unknown",
      address: "Unknown",
    });
  };

  const register = (data: { email: string; fullName: string; address: string }) => {
    setUser({
      email: data.email,
      fullName: data.fullName,
      address: data.address,
    });
  };

  const logout = () => setUser(null);

  const updateForumProfile = (data: {
    forumUsername: string;
    forumAvatar: string | null;
    agreedRules: boolean;
  }) => {
    if (!user) return;

    const initials = user.fullName
      .split(" ")
      .map((p) => p[0].toUpperCase())
      .join("");

    setUser({
      ...user,
      ...data,
      initials,
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        register,
        logout,
        updateForumProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext)!;

// 👇 Обязательный пустой экспорт для TS1208
export {};
