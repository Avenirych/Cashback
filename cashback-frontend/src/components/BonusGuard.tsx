import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LanguageContext";
import { translations } from "../i18n";

export default function BonusGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { lang } = useLang();
  const t = translations[lang.toUpperCase() as keyof typeof translations] ?? translations.EN;
  if (loading) return <p role="status">{t.creating}</p>;
  if (!user) return <Navigate to="/register" replace />;
  if (user.bonusEligible !== true) return <Navigate to="/profile" replace />;
  return <>{children}</>;
}
