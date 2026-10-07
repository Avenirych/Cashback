import React, { useState } from "react";
import { useAuth, RegisterResult } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import ForumLogo from "../components/ForumLogo";
import MoneyTree from "../components/MoneyTree";
import { translations } from "../i18n";
import { validateEmail } from "../utils/emailValidator";

const verifyText = {
  en: {
    title: "Check your email",
    sent: "We sent a verification link to",
    notSent: "The account was created, but the verification email could not be sent. Press the button below to try again.",
    demo: "Demo mode: this is a test mailbox (Ethereal). In production the email is delivered to the address you entered.",
    preview: "Open the test email",
    resend: "Send the email again",
    resent: "A new verification email has been requested.",
    later: "Continue to the site",
    note: "Access to all functions is blocked until email confirmation: bonuses, cashback, forum, store.",
    restrictedAccess: "Until you verify your email, you cannot access bonuses, forum, shop, or full profile. Verify above.",
  },
  ru: {
    title: "Проверьте почту",
    sent: "Мы отправили ссылку для подтверждения на адрес",
    notSent: "Аккаунт создан, но письмо не удалось отправить. Нажмите кнопку ниже, чтобы повторить.",
    demo: "Демо-режим: это тестовый почтовый ящик (Ethereal). В рабочем режиме письмо приходит на указанный вами адрес.",
    preview: "Открыть тестовое письмо",
    resend: "Отправить письмо ещё раз",
    resent: "Новое письмо с подтверждением запрошено.",
    later: "Перейти на сайт",
    note: "Доступ ко всем функциям заблокирован до подтверждения почты: бонусы, кэшбэк, форум, магазин.",
    restrictedAccess: "Пока ваша почта не подтверждена, вы не сможете открыть бонусы, форум, магазин или полный профиль. Подтвердите почту выше.",
  },
};

export default function Register({ lang, onLangChange }: { lang: string; onLangChange: (lang: string) => void }) {
  const { register, resendVerification } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RegisterResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState("");

  const t = translations[lang as keyof typeof translations] ?? translations.EN;
  const v = lang.toLowerCase() === "ru" ? verifyText.ru : verifyText.en;

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEmail = e.target.value;
    setForm({ ...form, email: newEmail });

    if (newEmail.trim()) {
      setEmailError(validateEmail(newEmail).error || "");
    } else {
      setEmailError("");
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!termsAccepted) {
      setError(t.mustAcceptTerms || "You must accept the terms and conditions to register");
      return;
    }

    const emailValidation = validateEmail(form.email);
    if (!emailValidation.valid) {
      setEmailError(emailValidation.error || "Invalid email");
      setError(emailValidation.error || "Email validation failed");
      return;
    }

    setError("");
    setEmailError("");
    setLoading(true);

    try {
      const registerResult = await register(form);
      setResult(registerResult);
      setPreviewUrl(registerResult.preview_url ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.loginRegister);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResendMessage("");
    setLoading(true);
    try {
      const resendResult = await resendVerification(form.email);
      setPreviewUrl(resendResult.preview_url ?? null);
      setResendMessage(v.resent);
    } catch (err) {
      setResendMessage(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  };

  const isFormValid =
    form.name.trim() &&
    form.email.trim() &&
    form.password.trim() &&
    termsAccepted &&
    validateEmail(form.email).valid;

  const inputStyle: React.CSSProperties = {
    padding: "12px",
    borderRadius: "6px",
    border: "1px solid #ddd",
    fontSize: "14px",
    width: "100%",
    boxSizing: "border-box",
  };

  return (
    <div style={{ minHeight: "calc(100vh - 72px)", background: "linear-gradient(to bottom, #f5e8d3, #e3d2b8)" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "40px 24px", display: "flex", justifyContent: "center", gap: "80px", alignItems: "flex-start" }}>
        <div style={{ flex: 1, maxWidth: "480px", minWidth: "300px" }}>
          <Link to="/" style={{ color: "#0d6efd", textDecoration: "none", marginBottom: "24px", display: "inline-block", fontSize: "14px" }}>
            ← {t.backToHome}
          </Link>

          <div style={{ backgroundColor: "white", padding: "32px", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
            <Link to="/" style={{ display: "inline-block", marginBottom: "24px", textDecoration: "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }}>
                <ForumLogo size={32} />
                <h1 style={{ margin: 0, fontSize: "24px", color: "#000" }}>
                  {result ? v.title : t.register}
                </h1>
              </div>
            </Link>

            {result ? (
              <div role="status" style={{ display: "grid", gap: "14px", color: "#333", fontSize: "14px", lineHeight: 1.5 }}>
                {result.verification_email_sent ? (
                  <p style={{ margin: 0 }}>
                    {v.sent} <strong>{form.email}</strong>.
                  </p>
                ) : (
                  <p style={{ margin: 0, color: "#b42318" }}>{v.notSent}</p>
                )}

                {previewUrl && (
                  <>
                    <p style={{ margin: 0, color: "#666" }}>{v.demo}</p>
                    <a
                      href={previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "#0d6efd", fontWeight: 600 }}
                    >
                      {v.preview} ↗
                    </a>
                  </>
                )}

                <p style={{ margin: 0, color: "#666" }}>{v.note}</p>

                {resendMessage && <p style={{ margin: 0 }}>{resendMessage}</p>}

                <button
                  type="button"
                  onClick={handleResend}
                  disabled={loading}
                  style={{ padding: "12px", borderRadius: "6px", border: "1px solid #0d6efd", background: "#fff", color: "#0d6efd", cursor: loading ? "not-allowed" : "pointer", fontSize: "15px" }}
                >
                  {v.resend}
                </button>

                <button
                  type="button"
                  onClick={() => navigate("/", { replace: true })}
                  style={{ padding: "12px", borderRadius: "6px", border: "none", background: "#0d6efd", color: "#fff", cursor: "pointer", fontSize: "15px" }}
                >
                  {v.later}
                </button>
              </div>
            ) : (
              <>
                {error && (
                  <div style={{ backgroundColor: "#fee", color: "#c33", padding: "12px", borderRadius: "8px", marginBottom: "16px", border: "1px solid #fcc" }}>
                    {error}
                  </div>
                )}

                <form onSubmit={submit} style={{ display: "grid", gap: "12px" }}>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    placeholder={t.name}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                    autoComplete="name"
                    disabled={loading}
                    style={inputStyle}
                  />

                  <div>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      placeholder={t.email}
                      value={form.email}
                      onChange={handleEmailChange}
                      required
                      autoComplete="email"
                      disabled={loading}
                      aria-invalid={emailError ? "true" : "false"}
                      aria-describedby={emailError ? "email-error" : undefined}
                      style={{
                        ...inputStyle,
                        border: emailError ? "1px solid #dc3545" : "1px solid #ddd",
                        backgroundColor: emailError ? "#ffe6e6" : "#fff",
                      }}
                    />
                    {emailError && (
                      <p id="email-error" role="alert" style={{ color: "#dc3545", fontSize: "12px", margin: "6px 0 0" }}>
                        {emailError}
                      </p>
                    )}
                  </div>

                  <input
                    id="password"
                    name="password"
                    type="password"
                    placeholder={t.minPassword}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required
                    autoComplete="new-password"
                    disabled={loading}
                    style={inputStyle}
                  />

                  <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", marginTop: "8px" }}>
                    <input
                      id="terms"
                      type="checkbox"
                      checked={termsAccepted}
                      onChange={(e) => setTermsAccepted(e.target.checked)}
                      disabled={loading}
                      style={{ marginTop: "4px", cursor: "pointer", width: "18px", height: "18px" }}
                    />
                    <label htmlFor="terms" style={{ fontSize: "13px", color: "#333", cursor: "pointer", lineHeight: "1.4" }}>
                      {t.agreeTerms || "I agree to the"}{" "}
                      <Link to="/terms" target="_blank" style={{ color: "#0d6efd", textDecoration: "none" }}>
                        {t.termsAndConditions || "Terms and Conditions"}
                      </Link>{" "}
                      {t.and || "and"}{" "}
                      <Link to="/contacts" target="_blank" style={{ color: "#0d6efd", textDecoration: "none" }}>
                        {t.privacyPolicy || "Privacy Policy"}
                      </Link>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !isFormValid}
                    style={{
                      padding: "12px",
                      backgroundColor: isFormValid ? "#0d6efd" : "#ccc",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      cursor: isFormValid && !loading ? "pointer" : "not-allowed",
                      fontSize: "16px",
                      fontWeight: 500,
                      marginTop: "8px",
                    }}
                  >
                    {loading ? t.creating : t.register}
                  </button>
                </form>

                <p style={{ marginTop: "24px", textAlign: "center", color: "#666" }}>
                  {t.haveAccount}{" "}
                  <Link to="/login" style={{ color: "#0d6efd", textDecoration: "none", fontWeight: 600 }}>
                    {t.login}
                  </Link>
                </p>
              </>
            )}
          </div>
        </div>

        <div style={{ flex: 1, maxWidth: "420px", minWidth: "300px" }}>
          <MoneyTree />
        </div>
      </div>
    </div>
  );
}