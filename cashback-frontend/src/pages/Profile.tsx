import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AUTH_API, useAuth } from "../context/AuthContext";
import { useLang } from "../context/LanguageContext";
import { translations } from "../i18n";
import JoinProgrammeModal, { isOnboardingState, OnboardingState } from "../components/JoinProgrammeModal";
import "./Profile.css";

export default function Profile() {
  const { user, token, loading } = useAuth();
  const { lang } = useLang();
  const t = translations[lang.toUpperCase() as keyof typeof translations] ?? translations.EN;
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<OnboardingState | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setState(null);
    setFailed(false);
    setOpen(false);
    if (!token) return;
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await fetch(`${AUTH_API}/onboarding`, {
          headers: { Authorization: "Bearer " + token },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Enrolment unavailable");
        const data = await response.json();
        if (!isOnboardingState(data)) throw new Error("Enrolment unavailable");
        if (!controller.signal.aborted) setState(data);
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      }
    };
    void load();
    return () => controller.abort();
  }, [token, attempt]);

  if (loading) return <p role="status">{t.creating}</p>;
  if (!user) return <main className="profile-container"><Link to="/login">{t.pleaseLogin}</Link></main>;

  return (
    <main className="profile-container">
      <h1>{t.profile}</h1>
      <p>{t.email}: {user.email}</p>
      <p>{t.name}: {user.name}</p>
      <p>{t.onboarding.balance}: {user.balance ?? 0}</p>
      {user.avatar_url && <img className="profile-avatar" src={user.avatar_url} alt={t.profile} />}
      <section className="programme-panel">
        <h2>{t.onboarding.join}</h2>
        <p>{t.onboarding.intro}</p>
        <p>{t.onboarding.capture}</p>
        <p role="status">{user.bonusEligible === true ? t.bonusReady : t.bonusNotReady}</p>
        {!state && !failed && <p role="status">{t.creating}</p>}
        {failed && <p role="alert">{t.onboarding.failure}</p>}
        {failed && <button onClick={() => setAttempt((value) => value + 1)}>{t.onboarding.retry}</button>}
        {state?.recipient && (
          <div>
            <h3>{t.onboarding.recipient}</h3>
            <p>{t.onboarding.holder}: {state.recipient.accountHolderNameMasked}</p>
            <p>{t.onboarding.sortCode}: {state.recipient.sortCodeMasked}</p>
            <p>{t.onboarding.account}: {state.recipient.accountNumberMasked}</p>
          </div>
        )}
        {user.bonusEligible === true ?
          <Link to="/bonuses">{t.getBonuses}</Link> :
          <button disabled={!state} onClick={() => setOpen(true)}>{t.onboarding.join}</button>}
      </section>
      {open && <JoinProgrammeModal t={t} onClose={() => setOpen(false)} />}
    </main>
  );
}
