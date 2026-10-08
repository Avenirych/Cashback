import React, { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

type Status = "loading" | "success" | "error";

export default function VerifyEmail({ lang }: { lang: string }) {
  const { verifyEmail, user, loading: authLoading } = useAuth();
  const [params] = useSearchParams();
  const verificationToken = params.get("token") || "";

  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState("");

  // Одна попытка на токен, в том числе при React StrictMode.
  const attempt = useRef<{
    token: string;
    promise: Promise<void>;
  } | null>(null);

  const ru = lang.toLowerCase() === "ru";
  const missingMessage = ru
    ? "Ваша почта пока не подтверждена. Вернитесь в окно подтверждения, чтобы повторно запросить письмо."
    : "Your email has not been verified. Return to the verification screen to request another email.";

  useEffect(() => {
    if (!verificationToken) {
      setStatus("error");
      setMessage(missingMessage);
      return;
    }

    let active = true;
    setStatus("loading");
    setMessage("");

    if (attempt.current?.token !== verificationToken) {
      attempt.current = {
        token: verificationToken,
        promise: verifyEmail(verificationToken),
      };
    }

    attempt.current.promise.then(
      () => {
        if (active) setStatus("success");
      },
      (error: unknown) => {
        if (!active) return;

        setStatus("error");
        setMessage(
          error instanceof Error
            ? error.message
            : ru
              ? "Не удалось подтвердить почту."
              : "Email verification failed."
        );
      }
    );

    return () => {
      active = false;
    };

    // verifyEmail получает актуальное значение при смене токена.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verificationToken, missingMessage]);

  const alreadyVerified =
    !authLoading &&
    !verificationToken &&
    user?.email_verified === true;

  const successful = status === "success" || alreadyVerified;

  return (
    <div
      style={{
        minHeight: "calc(100vh - 72px)",
        background:
          "linear-gradient(to bottom, #f5e8d3, #e3d2b8)",
        padding: "40px 24px",
      }}
    >
      <div
        style={{
          maxWidth: "480px",
          margin: "0 auto",
          background: "#fff",
          padding: "32px",
          borderRadius: "12px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        }}
      >
        {status === "loading" && !successful && (
          <p role="status">
            {ru ? "Подтверждаем почту..." : "Verifying your email..."}
          </p>
        )}

        {successful && (
          <>
            <p
              role="status"
              style={{ color: "#146c2e", fontWeight: 600 }}
            >
              {ru
                ? "Почта подтверждена. Спасибо!"
                : "Your email has been verified. Thank you!"}
            </p>

            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
              <Link to="/">
                {ru ? "На главную" : "Go to home page"}
              </Link>
              <Link to="/profile">
                {ru ? "Открыть профиль" : "Open profile"}
              </Link>
            </div>
          </>
        )}

        {status === "error" && !successful && (
          <>
            <p role="alert" style={{ color: "#b42318" }}>
              {message}
            </p>

            <Link
              to="/register"
              style={{
                display: "inline-block",
                padding: "12px 16px",
                background: "#0d6efd",
                color: "#fff",
                borderRadius: "6px",
                textDecoration: "none",
                marginBottom: "16px",
              }}
            >
              {ru
                ? "Вернуться к подтверждению почты"
                : "Return to email verification"}
            </Link>

            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
              <Link to="/">
                {ru ? "На главную" : "Go to home page"}
              </Link>
              <Link to="/login">
                {ru ? "Войти в существующий аккаунт" : "Log in"}
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}