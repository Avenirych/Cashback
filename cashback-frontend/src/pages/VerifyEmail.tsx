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
  const ru = lang.toLowerCase() === "ru";
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
        setNotice(ru ? "Если аккаунт ожидает подтверждения, письмо будет отправлено. Проверьте также папку «Спам». Повторная отправка доступна не чаще раза в минуту." : "If verification is needed, an email will be sent. Check spam too. Wait a minute before requesting another.");
      } else if (await checkVerification()) setStatus("success");
      else setNotice(ru ? "Почта ещё не подтверждена. Нажмите ссылку в письме." : "Email is not verified yet. Use the email link.");
    } catch { setNotice(ru ? "Не удалось выполнить запрос. Попробуйте позже. Для проверки статуса можно войти в аккаунт." : "Request failed. Try later or log in to check status."); }
    finally { setBusy(false); }
  };
  const button = { display: "inline-block", padding: "14px 24px", border: 0, borderRadius: 8, background: "#0d6efd", color: "white", fontSize: 17, textDecoration: "none", cursor: "pointer" };
  return <main style={{minHeight: "80vh", padding: "48px 20px", background: "#f5e8d3"}}>
    <section aria-live="polite" style={{maxWidth: 560, margin: "0 auto", padding: 32, background: "white", borderRadius: 12}}>
      {(loading || status === "loading") && !success && <p role="status">{ru ? "Подтверждаем почту…" : "Verifying email…"}</p>}
      {success && <>
        <h1>{ru ? "Электронная почта подтверждена!" : "Email verified!"}</h1>
        <p>{ru ? "Перейдите в профиль и завершите регистрацию." : "Continue to your profile to complete registration."}</p>
        <Link style={button} to="/profile">{ru ? "Перейти в профиль" : "Continue to profile"}</Link>
        {continueReview&&<p><Link style={button} to={continueReview}>{reviewCopy(lang)?.leave}</Link></p>}
      </>}
      {status === "error" && !loading && !success && <>
        <h1>{ru ? "Подтверждение почты" : "Email confirmation"}</h1>
        <p role="alert">{ru ? "Не удалось подтвердить почту. Ссылка могла истечь или уже использоваться; возможна также ошибка соединения. Проверьте статус почты или войдите в аккаунт. Если почта не подтверждена, запросите новое письмо." : "We could not confirm your email. The link may have expired or been used, or the connection failed. Check email status or log in. If it is still unverified, request another email."}</p>
        <button style={button} disabled={busy} onClick={() => action(false)}>{ru ? "Проверить почту" : "Check email"}</button>
        <form onSubmit={e => { e.preventDefault(); void action(true); }} style={{display: "grid", gap: 12, marginTop: 24}}>
          <label>{ru ? "Электронная почта" : "Email"}<input aria-label={ru ? "Электронная почта" : "Email"} type="email" required value={email} onChange={e => setEmail(e.target.value)} style={{display: "block", width: "100%", padding: 10, boxSizing: "border-box"}} /></label>
          <button style={button} disabled={busy}>{busy ? (ru ? "Подождите…" : "Please wait…") : (ru ? "Отправить письмо ещё раз" : "Resend email")}</button>
        </form>
        <p><Link to="/login">{ru ? "Войти в аккаунт" : "Log in"}</Link></p>
      </>}
      {notice && <p role="status">{notice}</p>}
      <p><Link to="/">{ru ? "На главную" : "Home"}</Link></p>
    </section>
  </main>;
}
