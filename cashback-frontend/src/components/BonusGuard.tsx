import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useOnboarding } from "../onboarding";

export default function BonusGuard() {
  const { user, loading } = useAuth();
  const { eligible } = useOnboarding();
  if (loading) return null;
  if (!user) return <Navigate to="/register" replace />;
  if (!eligible) return <Navigate to="/profile" replace state={{ bonusOnboardingRequired: true }} />;
  return <Outlet />;
}
