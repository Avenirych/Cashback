import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, useLocation, Link } from "react-router-dom";
import ForumLogo from "../components/ForumLogo";
import MoneyTree from "../components/MoneyTree";
import { validateEmail } from "../utils/emailValidator";
import { LoginFailure, LoginFailureKind } from "../loginErrors";
import messages from "../content/loginMessages.json";
import "./Login.css";

export default function Login({ lang }: { lang: string; onLangChange: (lang: string) => void }) {
  const { login, isEmailVerificationPending } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const nextValue = new URLSearchParams(location.search).get("next");
  const reviewNext = nextValue === "/forum/reviews/new" || nextValue === "/forum" ? nextValue : null;
  const language = lang.toLowerCase() as keyof typeof messages;
  const t = messages[language] || messages.en;
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState<LoginFailureKind | null>(null);
  const [emailError, setEmailError] = useState<"email" | "emailLong" | null>(null);
  const [loading, setLoading] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const inFlight = useRef(false);
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  useEffect(() => {
    if (signedIn) navigate(isEmailVerificationPending ? "/verify-email" : reviewNext || "/", { replace: true });
  }, [signedIn, isEmailVerificationPending, reviewNext, navigate]);
  const validationError = (email: string) => email.trim().length > 320 ? "emailLong" as const : "email" as const;
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (inFlight.current) return;
    if (!validateEmail(form.email).valid) { setEmailError(validationError(form.email)); return; }
    if (!form.password.trim()) return;
    inFlight.current = true; setError(null); setEmailError(null); setLoading(true);
    try { await login(form); setSignedIn(true); }
    catch (failure) {
      setError(failure instanceof LoginFailure ? failure.kind : failure instanceof TypeError ? "network" : "unknown");
    } finally { inFlight.current = false; setLoading(false); }
  };
  const valid = !!form.email.trim() && !!form.password.trim() && validateEmail(form.email).valid;
  return <main className="login-page" lang={language}>
    <div className="login-layout">
      <Link to="/" className="login-home">← {t.home}</Link>
      <div className="login-top">
        <div className="login-card">
          <div className="login-title"><ForumLogo size={32}/><h1>{t.title}</h1></div>
          <p>{t.intro}</p>
          {error && <div className="login-error" role="alert" tabIndex={-1} ref={errorRef}>{t.errors[error]}</div>}
          <form onSubmit={submit} aria-busy={loading}>
            <div>
              <label htmlFor="email">{t.email}</label>
              <input id="email" name="email" type="email" autoComplete="email" required disabled={loading}
                value={form.email} onChange={event => {
                  const email = event.target.value; setForm({ ...form, email });
                  setEmailError(email.trim() && !validateEmail(email).valid ? validationError(email) : null);
                }} aria-invalid={!!emailError} aria-describedby={emailError ? "email-error" : undefined}/>
              {emailError && <p className="login-field-error" id="email-error" role="alert">{t.errors[emailError]}</p>}
            </div>
            <div>
              <label htmlFor="password">{t.password}</label>
              <input id="password" name="password" type="password" autoComplete="current-password" required
                disabled={loading} value={form.password} onChange={event => setForm({ ...form, password: event.target.value })}/>
            </div>
            <button type="submit" disabled={loading || !valid}>{loading ? t.loading : t.submit}</button>
          </form>
          <div className="login-recovery"><p>{t.forgot}</p><p>{t.recoveryUnavailable} <Link to="/contacts">{t.contacts}</Link></p></div>
          <p className="login-register">{t.noAccount}{" "}<Link to={reviewNext ? "/register?next=" + encodeURIComponent(reviewNext) : "/register"}>{t.register}</Link></p>
        </div>
        <aside className="login-illustration" aria-hidden="true"><MoneyTree/></aside>
      </div>
      <div className="login-info">
        <section><h2>{t.securityTitle}</h2><p>{t.security}</p><p>{t.attempts}</p></section>
        <section><h2>{t.privacyTitle}</h2><p>{t.privacyBefore}<Link to="/privacy">{t.privacyLink}</Link>{t.privacyAfter}</p></section>
        <section><h2>{t.importantTitle}</h2><p>{t.important}</p><p>{t.age}</p></section>
      </div>
    </div>
  </main>;
}
