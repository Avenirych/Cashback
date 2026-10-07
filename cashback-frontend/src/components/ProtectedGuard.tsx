import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * Защита для защищённых страниц: форум, магазин, профиль.
 * Неподтверждённый пользователь редирект на /verify-email.
 */
export default function ProtectedGuard() {
  const { user, loading, isEmailVerificationPending } = useAuth();

  if (loading) return null;

  // Не авторизован → на регистрацию
  if (!user) return <Navigate to="/register" replace />;

  // Email не подтверждён → на страницу подтверждения
  if (isEmailVerificationPending || !user.email_verified) {
    return <Navigate to="/verify-email" replace />;
  }

  return <Outlet />;
}