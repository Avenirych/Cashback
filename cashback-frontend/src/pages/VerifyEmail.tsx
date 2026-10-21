import React, { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function VerifyEmail({ lang }: { lang: string }) {
  const { verifyEmail, checkVerification, resendVerification, user } = useAuth();
  const [params] = useSearchParams();
  const [token] = useState(() => params.get("token") || "");
  const [status, setStatus] = useState<"loading" | "success" | "error">(token ? "loading" : "error");
  const [email, setEmail] = useState(user?.email || "");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const attempt = useRef<Promise<void> | null>(null);
  const ru = lang.toLowerCase() === "ru";
  useEffect(() => {
    if (!token) return;
    // Remove the secret from browser history before any further navigation.
    window.history.replaceState(window.history.state, "", window.location.pathname);
    let active = true;
    if (!attempt.current) attempt.current = verifyEmail(token);
    attempt.current.then(() => { if (active) setStatus("success"); }, () => { if (active) setStatus("error"); });
    return () => { active = false; };
    // StrictMode reuses the same in-flight promise; never replay a token.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
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
      {status === "loading" && !success && <p role="status">{ru ? "Подтверждаем почту…" : "Verifying email…"}</p>}
      {success && <>
        <h1>{ru ? "Электронная почта подтверждена!" : "Email verified!"}</h1>
        <p>{ru ? "Перейдите в профиль и завершите регистрацию." : "Continue to your profile to complete registration."}</p>
        <Link style={button} to="/profile">{ru ? "Перейти в профиль" : "Continue to profile"}</Link>
      </>}
      {status === "error" && !success && <>
        <h1>{ru ? "Подтверждение почты" : "Email confirmation"}</h1>
        <p role="alert">{ru ? "Ссылка недействительна, уже использована или срок её действия истёк. Если результат запроса неизвестен, сначала проверьте статус почты — не открывайте ссылку повторно." : "This link is invalid, used or expired. If the result is unknown, check status before opening the link again."}</p>
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
