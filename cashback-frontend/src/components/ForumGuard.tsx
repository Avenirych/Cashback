import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LanguageContext";

export default function ForumGuard({ readOnly = false }: { readOnly?: boolean }) {
  const { user, loading, isEmailVerificationPending, forumLoading, forumUser, forumSessionActive, forumBanned } = useAuth();
  const ru = useLang().lang.toLowerCase() === "ru";
  if (loading) return null;
  if (!user) return <Navigate to="/register" replace />;
  if (isEmailVerificationPending || !user.email_verified) return <Navigate to="/verify-email" replace />;
  if (forumLoading) return <p role="status">{ru ? "Загрузка форума…" : "Loading forum…"}</p>;
  const bannedNotice = <p role="alert">{ru ? "Ваш аккаунт форума заблокирован. Доступен только просмотр." : "Your forum account is banned. Read-only access is available."}</p>;
  if (readOnly) return <>{(forumBanned || forumUser?.banned) && bannedNotice}<Outlet /></>;
  if (forumBanned || forumUser?.banned) return bannedNotice;
  if (!forumUser || !forumSessionActive) return <Navigate to="/forum/register" replace />;
  return <Outlet />;
}
