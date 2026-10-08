import React, { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth, RegisterResult } from "../context/AuthContext";
import ForumLogo from "../components/ForumLogo";
import MoneyTree from "../components/MoneyTree";
import { translations } from "../i18n";
import { validateEmail } from "../utils/emailValidator";

const PENDING_VERIFICATION_KEY = "cashback_pending_verification";

interface PendingVerification extends RegisterResult {
  email: string;
}

function readPendingVerification(): PendingVerification | null {
  try {
    const raw = sessionStorage.getItem(PENDING_VERIFICATION_KEY);
    if (!raw) return null;

    const data = JSON.parse(raw);

    if (
      typeof data.email !== "string" ||
      !validateEmail(data.email).valid
    ) {
      return null;
    }

    return {
      email: data.email,
      verification_email_sent:
        typeof data.verification_email_sent === "boolean"
          ? data.verification_email_sent
          : undefined,
      preview_url:
        typeof data.preview_url === "string"
          ? data.preview_url
          : null,
    };
  } catch {
    return null;
  }
}

function savePendingVerification(data: PendingVerification) {
  try {
    sessionStorage.setItem(
      PENDING_VERIFICATION_KEY,
      JSON.stringify(data)
    );
  } catch {
    // Экран продолжает работать в памяти.
  }
}

const verifyText = {
  en: {
    title: "Check your email",
    sent: "We sent a verification link to",
    pending: "Email verification is pending for",
    notSent:
      "Your account was created, but the email could not be sent. Try requesting another email.",
    demo:
      "Test mode: open the preview below. In production, the email is delivered to your address.",
    preview: "Open the test email",
    resend: "Send the email again",
    resent:
      "Request processed. If this account still needs verification and delivery succeeds, a new email will arrive.",
    later: "Continue to the site",
    note:
      "Bonuses, cashback, forum, shop and full profile remain unavailable until email verification.",
    waiting: "Please wait...",
  },
  ru: {
    title: "Проверьте почту",
    sent: "Мы отправили ссылку для подтверждения на адрес",
    pending: "Ожидается подтверждение почты",
    notSent:
      "Аккаунт создан, но письмо не удалось отправить. Попробуйте запросить письмо ещё раз.",
    demo:
      "Тестовый режим: откройте письмо по ссылке ниже. В рабочем режиме письмо приходит на ваш адрес.",
    preview: "Открыть тестовое письмо",
    resend: "Отправить письмо ещё раз",
    resent:
      "Запрос обработан. Если аккаунту ещё требуется подтверждение и отправка будет успешной, придёт новое письмо.",
    later: "Перейти на сайт",
    note:
      "Бонусы, кэшбэк, форум, магазин и полный профиль недоступны до подтверждения почты.",
    waiting: "Подождите...",
  },
};

export default function Register({
  lang,
}: {
  lang: string;
  onLangChange: (lang: string) => void;
}) {
  const {
    register,
    resendVerification,
    user,
    loading: authLoading,
  } = useAuth();

  const navigate = useNavigate();
  const [pending, setPending] =
    useState<PendingVerification | null>(readPendingVerification);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resendMessage, setResendMessage] = useState("");

  const language = lang.toUpperCase();
  const t =
    translations[language as keyof typeof translations] ??
    translations.EN;
  const v =
    language === "RU" ? verifyText.ru : verifyText.en;

  // Данные текущего аккаунта имеют приоритет над сохранённым адресом.
  const verification: PendingVerification | null =
    user && !user.email_verified
      ? pending?.email === user.email
        ? pending
        : { email: user.email }
      : pending;

  const handleEmailChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const email = e.target.value;
    setForm((previous) => ({ ...previous, email }));
    setEmailError(
      email.trim() ? validateEmail(email).error || "" : ""
    );
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setResendMessage("");

    if (!termsAccepted) {
      setError(t.mustAcceptTerms);
      return;
    }

    const validation = validateEmail(form.email);

    if (!validation.valid) {
      setEmailError(validation.error || "Invalid email");
      return;
    }

    setBusy(true);

    try {
      const result = await register({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
      });

      const next: PendingVerification = {
        email: form.email.trim().toLowerCase(),
        ...result,
      };

      savePendingVerification(next);
      setPending(next);

      // Пароль не сохраняем ни в sessionStorage, ни в localStorage.
      setForm((previous) => ({ ...previous, password: "" }));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t.loginRegister
      );
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    if (!verification?.email || busy) return;

    setError("");
    setResendMessage("");
    setBusy(true);

    try {
      const result = await resendVerification(verification.email);
      const next: PendingVerification = {
        email: verification.email,
        // API повторной отправки не гарантирует доставку письма.
        verification_email_sent: undefined,
        preview_url: result.preview_url ?? null,
      };

      savePendingVerification(next);
      setPending(next);
      setResendMessage(v.resent);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not resend verification email"
      );
    } finally {
      setBusy(false);
    }
  };

  const isFormValid = Boolean(
    form.name.trim().length >= 2 &&
      form.password.length >= 3 &&
      termsAccepted &&
      validateEmail(form.email).valid
  );

  const inputStyle: React.CSSProperties = {
    padding: "12px",
    borderRadius: "6px",
    border: "1px solid #ddd",
    fontSize: "14px",
    width: "100%",
    boxSizing: "border-box",
  };

  const buttonStyle: React.CSSProperties = {
    padding: "12px",
    borderRadius: "6px",
    border: "none",
    background: "#0d6efd",
    color: "#fff",
    cursor: busy ? "not-allowed" : "pointer",
    fontSize: "15px",
  };

  if (authLoading) {
    return <p role="status">{v.waiting}</p>;
  }

  if (user?.email_verified) {
    return <Navigate to="/profile" replace />;
  }

  return (
    <div
      style={{
        minHeight: "calc(100vh - 72px)",
        background:
          "linear-gradient(to bottom, #f5e8d3, #e3d2b8)",
      }}
    >
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "40px 24px",
          display: "flex",
          justifyContent: "center",
          gap: "80px",
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, maxWidth: "480px", minWidth: "280px" }}>
          <Link
            to="/"
            style={{
              color: "#0d6efd",
              textDecoration: "none",
              marginBottom: "24px",
              display: "inline-block",
            }}
          >
            {t.backToHome}
          </Link>

          <div
            style={{
              background: "#fff",
              padding: "32px",
              borderRadius: "12px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                marginBottom: "24px",
              }}
            >
              <ForumLogo size={32} />
              <h1 style={{ margin: 0, fontSize: "24px" }}>
                {verification ? v.title : t.register}
              </h1>
            </div>

            {error && (
              <p role="alert" style={{ color: "#b42318" }}>
                {error}
              </p>
            )}

            {verification ? (
              <div
                style={{
                  display: "grid",
                  gap: "14px",
                  color: "#333",
                  lineHeight: 1.5,
                }}
              >
                {verification.verification_email_sent === false ? (
                  <>
                    <p style={{ margin: 0 }}>{v.notSent}</p>
                    <strong>{verification.email}</strong>
                  </>
                ) : (
                  <p style={{ margin: 0 }}>
                    {verification.verification_email_sent === true
                      ? v.sent
                      : v.pending}{" "}
                    <strong>{verification.email}</strong>
                  </p>
                )}

                {verification.preview_url && (
                  <>
                    <p style={{ margin: 0 }}>{v.demo}</p>
                    <a
                      href={verification.preview_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "#0d6efd" }}
                    >
                      {v.preview}
                    </a>
                  </>
                )}

                <p style={{ margin: 0 }}>{v.note}</p>

                {resendMessage && (
                  <p role="status" style={{ margin: 0 }}>
                    {resendMessage}
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleResend}
                  disabled={busy}
                  style={buttonStyle}
                >
                  {busy ? v.waiting : v.resend}
                </button>

                <button
                  type="button"
                  onClick={() => navigate("/")}
                  style={{
                    ...buttonStyle,
                    background: "#fff",
                    color: "#0d6efd",
                    border: "1px solid #0d6efd",
                  }}
                >
                  {v.later}
                </button>

                <Link to="/login" style={{ color: "#0d6efd" }}>
                  {t.haveAccount} {t.login}
                </Link>
              </div>
            ) : (
              <>
                <form
                  onSubmit={submit}
                  style={{ display: "grid", gap: "12px" }}
                >
                  <input
                    id="name"
                    name="name"
                    type="text"
                    aria-label={t.name}
                    placeholder={t.name}
                    value={form.name}
                    onChange={(e) =>
                      setForm({ ...form, name: e.target.value })
                    }
                    required
                    minLength={2}
                    autoComplete="name"
                    disabled={busy}
                    style={inputStyle}
                  />

                  <div>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      aria-label={t.email}
                      placeholder={t.email}
                      value={form.email}
                      onChange={handleEmailChange}
                      required
                      autoComplete="email"
                      disabled={busy}
                      aria-invalid={Boolean(emailError)}
                      aria-describedby={
                        emailError ? "email-error" : undefined
                      }
                      style={inputStyle}
                    />
                    {emailError && (
                      <p
                        id="email-error"
                        role="alert"
                        style={{ color: "#b42318", fontSize: "12px" }}
                      >
                        {emailError}
                      </p>
                    )}
                  </div>

                  <input
                    id="password"
                    name="password"
                    type="password"
                    aria-label={t.password}
                    placeholder={t.minPassword}
                    value={form.password}
                    onChange={(e) =>
                      setForm({ ...form, password: e.target.value })
                    }
                    required
                    minLength={3}
                    autoComplete="new-password"
                    disabled={busy}
                    style={inputStyle}
                  />

                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "10px",
                    }}
                  >
                    <input
                      id="terms"
                      type="checkbox"
                      checked={termsAccepted}
                      onChange={(e) =>
                        setTermsAccepted(e.target.checked)
                      }
                      disabled={busy}
                    />
                    <label htmlFor="terms" style={{ fontSize: "13px" }}>
                      {t.agreeTerms}{" "}
                      <Link
                        to="/terms"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {t.termsAndConditions}
                      </Link>{" "}
                      {t.and}{" "}
                      <Link
                        to="/contacts"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {t.privacyPolicy}
                      </Link>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={busy || !isFormValid}
                    style={{
                      ...buttonStyle,
                      opacity: busy || !isFormValid ? 0.6 : 1,
                    }}
                  >
                    {busy ? t.creating : t.register}
                  </button>
                </form>

                <p style={{ marginTop: "24px", textAlign: "center" }}>
                  {t.haveAccount}{" "}
                  <Link to="/login">{t.login}</Link>
                </p>
              </>
            )}
          </div>
        </div>

        <div style={{ flex: 1, maxWidth: "420px", minWidth: "280px" }}>
          <MoneyTree />
        </div>
      </div>
    </div>
  );
}