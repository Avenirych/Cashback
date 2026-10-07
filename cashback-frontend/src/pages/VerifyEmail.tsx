import React, { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

type Status = "loading" | "success" | "error";

export default function VerifyEmail({ lang }: { lang: string }) {
  const { verifyEmail } = useAuth();
  const [params] = useSearchParams();
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState("");
  const started = useRef(false);

  const ru = lang.toLowerCase() === "ru";
  const text = {
    loading: ru ? "Подтверждаем почту..." : "Verifying your email...",
    success: ru ? "Почта подтверждена. Спасибо!" : "Your email has been verified. Thank you!",
    missing: ru ? "В ссылке нет токена подтверждения." : "The link does not contain a verification token.",
    home: ru ? "На главную" : "Go to home page",
    profile: ru ? "Открыть профиль" : "Open profile",
    register: ru ? "Зарегистрироваться" : "Register",
  };

  useEffect(() => {
    // The token is single-use; guard against React StrictMode double effects.
    if (started.current) return;
    started.current = true;

    const token = params.get("token");

    if (!token) {
      setStatus("error");
      setMessage(text.missing);
      return;
    }

    verifyEmail(token)
      .then(() => setStatus("success"))
      .catch((err) => {
        setStatus("error");
        setMessage(err instanceof Error ? err.message : "Verification failed");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ minHeight: "calc(100vh - 72px)", background: "linear-gradient(to bottom, #f5e8d3, #e3d2b8)", padding: "40px 24px" }}>
      <div style={{ maxWidth: "480px", margin: "0 auto", background: "#fff", padding: "32px", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
        {status === "loading" && <p role="status">{text.loading}</p>}

        {status === "success" && (
          <>
            <p role="status" style={{ color: "#146c2e", fontWeight: 600 }}>{text.success}</p>
            <div style={{ display: "flex", gap: "16px" }}>
              <Link to="/" style={{ color: "#0d6efd" }}>{text.home}</Link>
              <Link to="/profile" style={{ color: "#0d6efd" }}>{text.profile}</Link>
            </div>
          </>
        )}

        {status === "error" && (
          <>
            <p role="alert" style={{ color: "#b42318" }}>{message}</p>
            <div style={{ display: "flex", gap: "16px" }}>
              <Link to="/" style={{ color: "#0d6efd" }}>{text.home}</Link>
              <Link to="/register" style={{ color: "#0d6efd" }}>{text.register}</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}