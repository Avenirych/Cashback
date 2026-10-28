import copy from "../content/verifyEmail.json";
import React, { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {reviewIntent} from '../reviewReturn';
import {reviewCopy} from '../components/ReviewsCarousel';

export default function VerifyEmail({ lang }: { lang: string }) {
  const { verifyEmail, checkVerification, resendVerification, user, loading } = useAuth();
  const [params] = useSearchParams();
  const [token] = useState(() => params.get("token") || "");
  const [status, setStatus] = useState<"loading" | "success" | "error">(token ? "loading" : "error");
  const [email, setEmail] = useState(user?.email || "");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const attempt = useRef<Promise<void> | null>(null);
  const t = copy[lang.toLowerCase() as keyof typeof copy] || copy.en;
  const [continueReview]=useState(reviewIntent);
  useEffect(() => {
    if (!token) return;
    // Remove the secret from browser history before any further navigation.
    window.history.replaceState(window.history.state, "", window.location.pathname);
    if (loading) return;
    let active = true;
    if (!attempt.current) attempt.current = verifyEmail(token).catch(async () => {
      // A failed response is not proof that the one-time operation failed.
      // Only the authenticated profile may establish this session's status.
      if (!user?.id || !(await checkVerification(user.id))) throw new Error("Verification not confirmed");
    });
    attempt.current.then(() => { if (active) setStatus("success"); }, () => { if (active) setStatus("error"); });
    return () => { active = false; };
    // StrictMode reuses the same in-flight promise; never replay a token.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, loading]);
  const success = status === "success" || (!token && user?.email_verified === true);
  const action = async (resend: boolean) => {
    if (busy) return;
    setBusy(true); setNotice("");
    try {
      if (resend) {
        await resendVerification(email || user?.email || "");
        setNotice(t.noticeSent);
      } else if (await checkVerification()) setStatus("success");
      else setNotice(t.notVerified);
    } catch { setNotice(t.requestFailed); }
    finally { setBusy(false); }
  };
  const button = { display: "inline-block", padding: "14px 24px", border: 0, borderRadius: 8, background: "#0d6efd", color: "white", fontSize: 17, textDecoration: "none", cursor: "pointer" };
  return <main style={{minHeight: "80vh", padding: "48px 20px", background: "#f5e8d3"}}>
    <section aria-live="polite" style={{maxWidth: 560, margin: "0 auto", padding: 32, background: "white", borderRadius: 12}}>
      {(loading || status === "loading") && !success && <p role="status">{t.verifying}</p>}
      {success && <>
        <h1>{t.successTitle}</h1>
        <p>{t.successContinue}</p>
        <Link style={button} to="/profile">{t.profile}</Link>
        {continueReview&&<p><Link style={button} to={continueReview}>{reviewCopy(lang)?.leave}</Link></p>}
      </>}
      {status === "error" && !loading && !success && <>
        <h1>{t.confirmationTitle}</h1>
        <p role="alert">{t.errorDescription}</p>
        <button style={button} disabled={busy} onClick={() => action(false)}>{t.checkEmail}</button>
        <form onSubmit={e => { e.preventDefault(); void action(true); }} style={{display: "grid", gap: 12, marginTop: 24}}>
          <label>{t.email}<input aria-label={t.email} type="email" required value={email} onChange={e => setEmail(e.target.value)} style={{display: "block", width: "100%", padding: 10, boxSizing: "border-box"}} /></label>
          <button style={button} disabled={busy}>{busy ? (t.waiting) : (t.resend)}</button>
        </form>
        <p><Link to="/login">{t.login}</Link></p>
      </>}
      {notice && <p role="status">{notice}</p>}
      <p><Link to="/">{t.home}</Link></p>
    </section>
  </main>;
}
