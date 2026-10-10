import React, { useEffect, useMemo, useState } from "react";
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import type { RegisterResult } from "../context/AuthContext";
import ForumLogo from "../components/ForumLogo";
import MoneyTree from "../components/MoneyTree";
import { translations } from "../i18n";
import { validateEmail } from "../utils/emailValidator";

const PENDING_VERIFICATION_KEY = "cashback_pending_verification";
const RETURN_PATH_KEY = "cashback_post_auth_next";

interface PendingVerification extends RegisterResult {
  email: string;
}

type PasswordChecks = {
  minLen: boolean;
  hasUpper: boolean;
  hasLower: boolean;
  hasDigit: boolean;
  hasSpecial: boolean;
};

function getPasswordChecks(password: string): PasswordChecks {
  return {
    minLen: password.length >= 8,
    hasUpper: /[A-Z]/.test(password),
    hasLower: /[a-z]/.test(password),
    hasDigit: /\d/.test(password),
    hasSpecial: /[^A-Za-z0-9]/.test(password),
  };
}

function isStrongPassword(password: string): boolean {
  const c = getPasswordChecks(password);
  return (
    c.minLen &&
    c.hasUpper &&
    c.hasLower &&
    c.hasDigit &&
    c.hasSpecial
  );
}

/**
 * Разрешаем возвращаться только в разделы магазина и бонусов.
 * Внешние адреса и произвольные маршруты не принимаем.
 */
function safeReturnPath(value: string | null): string | null {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    return null;
  }

  try {
    const url = new URL(value, window.location.origin);

    if (url.origin !== window.location.origin) return null;

    const allowed =
      url.pathname === "/shop" ||
      url.pathname === "/bonuses" ||
      url.pathname.startsWith("/bonuses/");

    if (!allowed) return null;

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

function readSavedReturnPath(): string | null {
  try {
    return safeReturnPath(sessionStorage.getItem(RETURN_PATH_KEY));
  } catch {
    return null;
  }
}

function readPendingVerification(): PendingVerification | null {
  try {
    const raw = sessionStorage.getItem(PENDING_VERIFICATION_KEY);
    if (!raw) return null;

    const data = JSON.parse(raw);

    if (
      !data ||
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
    later: "Continue browsing",
    note:
      "You can browse public pages. Purchases, bonus actions and other protected features require email verification.",
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
    later: "Продолжить просмотр",
    note:
      "Можно просматривать открытые страницы. Покупки, действия с бонусами и другие защищённые функции требуют подтверждения почты.",
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
  const location = useLocation();

  const requestedReturnPath = safeReturnPath(
    new URLSearchParams(location.search).get("next")
  );

  const [savedReturnPath] = useState(readSavedReturnPath);

  const returnPath =
    requestedReturnPath ?? savedReturnPath ?? "/profile";

  const loginPath =
    returnPath === "/profile"
      ? "/login"
      : `/login?next=${encodeURIComponent(returnPath)}`;

  const [pending, setPending] = useState<PendingVerification | null>(
    readPendingVerification
  );

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
  });

  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resendMessage, setResendMessage] = useState("");

  const language = lang.toUpperCase();
  const t =
    translations[language as keyof typeof translations] ??
    translations.EN;

  const v = language === "RU" ? verifyText.ru : verifyText.en;

  const passwordChecks = useMemo(
    () => getPasswordChecks(form.password),
    [form.password]
  );

  useEffect(() => {
    if (!requestedReturnPath) return;

    try {
      sessionStorage.setItem(
        RETURN_PATH_KEY,
        requestedReturnPath
      );
    } catch {
      // Возврат по query-параметру продолжает работать.
    }
  }, [requestedReturnPath]);

  useEffect(() => {
    if (!user?.email_verified) return;

    try {
      sessionStorage.removeItem(PENDING_VERIFICATION_KEY);
      sessionStorage.removeItem(RETURN_PATH_KEY);
    } catch {
      // Ошибка хранилища не блокирует переход.
    }
  }, [user?.email_verified]);

  const verification: PendingVerification | null =
    user && !user.email_verified
      ? pending?.email === user.email
        ? pending
        : { email: user.email }
      : pending;

  const handleGoogleRegister = () => {
    if (busy) return;

    // Чтобы не ломать локальный запуск без backend/oauth:
    // перевключай через env-переменную.
    const enabled =
      (typeof window !== "undefined" &&
        (window as any).process &&
        (window as any).process.env &&
        (window as any).process.env.REACT_APP_GOOGLE_AUTH_ENABLED === "true") ||
      (typeof process !== "undefined" &&
        process.env.REACT_APP_GOOGLE_AUTH_ENABLED === "true");

    if (!enabled) {
      setError(
        language === "RU"
          ? "Google регистрация временно недоступна."
          : "Google registration is temporarily unavailable."
      );
      return;
    }

    if (!termsAccepted) {
      setError(t.mustAcceptTerms);
      return;
    }

    const next = encodeURIComponent(returnPath);
    window.location.href = `/auth/google/start?next=${next}`;
  };

  const handleEmailChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const email = e.target.value;

    setForm((previous) => ({ ...previous, email }));

    setEmailError(
      email.trim() ? validateEmail(email).error || "" : ""
    );
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (busy) return;

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
    } else {
      setEmailError("");
    }

    if (!isStrongPassword(form.password)) {
      setPasswordError(
        language === "RU"
          ? "Пароль слишком простой: минимум 8 символов, A-Z, a-z, цифра и спецсимвол."
          : "Password is too weak: min 8 chars, A-Z, a-z, digit and special symbol."
      );
      return;
    } else {
      setPasswordError("");
    }

    setBusy(true);

    try {
      const fullName = `${form.firstName.trim()} ${form.lastName.trim()}`.trim();

      const result = await register({
        // Старый backend всё ещё принимает name.
        name: fullName,
        // Новый backend сможет читать отдельные поля.
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
      } as any);

      const pendingVerification: PendingVerification = {
        ...result,
        email: form.email.trim().toLowerCase(),
      };

      savePendingVerification(pendingVerification);
      setPending(pendingVerification);

      setForm((previous) => ({
        ...previous,
        firstName: "",
        lastName: "",
        password: "",
      }));
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

      const pendingVerification: PendingVerification = {
        email: verification.email,
        verification_email_sent: undefined,
        preview_url: result.preview_url ?? null,
      };

      savePendingVerification(pendingVerification);
      setPending(pendingVerification);
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

  const isFormValid =
    form.firstName.trim().length >= 2 &&
    form.lastName.trim().length >= 2 &&
    validateEmail(form.email).valid &&
    isStrongPassword(form.password) &&
    termsAccepted;

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
    return <Navigate to={returnPath} replace />;
  }

  return (
    <div
      style={{
        minHeight: "calc(100vh - 72px)",
        background: "linear-gradient(to bottom, #f5e8d3, #e3d2b8)",
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
        <div
          style={{
            flex: 1,
            maxWidth: "480px",
            minWidth: "280px",
          }}
        >
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
                  onClick={() =>
                    navigate(returnPath === "/profile" ? "/" : returnPath)
                  }
                  style={{
                    ...buttonStyle,
                    background: "#fff",
                    color: "#0d6efd",
                    border: "1px solid #0d6efd",
                  }}
                >
                  {v.later}
                </button>

                <Link to={loginPath} style={{ color: "#0d6efd" }}>
                  {t.haveAccount} {t.login}
                </Link>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleGoogleRegister}
                  disabled={busy}
                  style={{
                    ...buttonStyle,
                    width: "100%",
                    background: "#fff",
                    color: "#111",
                    border: "1px solid #d9d9d9",
                    marginBottom: 12,
                  }}
                >
                  Continue with Google
                </button>

                <div
                  style={{
                    textAlign: "center",
                    margin: "10px 0 14px",
                    color: "#777",
                  }}
                >
                  or
                </div>

                <form
                  onSubmit={submit}
                  style={{ display: "grid", gap: "12px" }}
                >
                  <input
                    id="firstName"
                    name="firstName"
                    type="text"
                    aria-label={
                      language === "RU" ? "Имя" : "First name"
                    }
                    placeholder={
                      language === "RU" ? "Имя" : "First name"
                    }
                    value={form.firstName}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        firstName: e.target.value,
                      }))
                    }
                    required
                    minLength={2}
                    autoComplete="given-name"
                    disabled={busy}
                    style={inputStyle}
                  />

                  <input
                    id="lastName"
                    name="lastName"
                    type="text"
                    aria-label={
                      language === "RU" ? "Фамилия" : "Last name"
                    }
                    placeholder={
                      language === "RU" ? "Фамилия" : "Last name"
                    }
                    value={form.lastName}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        lastName: e.target.value,
                      }))
                    }
                    required
                    minLength={2}
                    autoComplete="family-name"
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
                        style={{
                          color: "#b42318",
                          fontSize: "12px",
                        }}
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
                      setForm((p) => ({
                        ...p,
                        password: e.target.value,
                      }))
                    }
                    required
                    minLength={8}
                    autoComplete="new-password"
                    disabled={busy}
                    style={inputStyle}
                  />

                  {passwordError && (
                    <p
                      role="alert"
                      style={{
                        color: "#b42318",
                        fontSize: "12px",
                        margin: 0,
                      }}
                    >
                      {passwordError}
                    </p>
                  )}

                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: 18,
                      fontSize: 12,
                      color: "#444",
                      lineHeight: 1.5,
                    }}
                  >
                    <li
                      style={{
                        color: passwordChecks.minLen ? "green" : "#666",
                      }}
                    >
                      {language === "RU"
                        ? "Минимум 8 символов"
                        : "At least 8 characters"}
                    </li>
                    <li
                      style={{
                        color: passwordChecks.hasUpper ? "green" : "#666",
                      }}
                    >
                      {language === "RU"
                        ? "Хотя бы 1 заглавная буква (A-Z)"
                        : "At least 1 uppercase letter (A-Z)"}
                    </li>
                    <li
                      style={{
                        color: passwordChecks.hasLower ? "green" : "#666",
                      }}
                    >
                      {language === "RU"
                        ? "Хотя бы 1 строчная буква (a-z)"
                        : "At least 1 lowercase letter (a-z)"}
                    </li>
                    <li
                      style={{
                        color: passwordChecks.hasDigit ? "green" : "#666",
                      }}
                    >
                      {language === "RU"
                        ? "Хотя бы 1 цифра"
                        : "At least 1 digit"}
                    </li>
                    <li
                      style={{
                        color: passwordChecks.hasSpecial ? "green" : "#666",
                      }}
                    >
                      {language === "RU"
                        ? "Хотя бы 1 спецсимвол"
                        : "At least 1 special character"}
                    </li>
                  </ul>

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

                    <label
                      htmlFor="terms"
                      style={{ fontSize: "13px" }}
                    >
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
                      opacity:
                        busy || !isFormValid ? 0.6 : 1,
                    }}
                  >
                    {busy ? t.creating : t.register}
                  </button>
                </form>

                <p
                  style={{
                    marginTop: "24px",
                    textAlign: "center",
                  }}
                >
                  {t.haveAccount}{" "}
                  <Link to={loginPath}>{t.login}</Link>
                </p>
              </>
            )}
          </div>
        </div>

        <div
          style={{
            flex: 1,
            maxWidth: "420px",
            minWidth: "280px",
          }}
        >
          <MoneyTree />
        </div>
      </div>
    </div>
  );
}