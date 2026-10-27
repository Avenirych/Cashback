import React, { useEffect, useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import type { RegisterResult } from "../context/AuthContext";
import PhoneInput from "../components/PhoneInput";
import { canonicalPhone } from "../utils/phone";
import { readDraft, saveDraft, clearDraft, passwordChecks } from "../utils/registrationDraft";
import MarketingPreferencesPanel from "../components/MarketingPreferencesPanel";
import ForumLogo from "../components/ForumLogo";
import MoneyTree from "../components/MoneyTree";
import "./Register.css";
import registrationUi from "../content/registrationUi.json";
import { translations } from "../i18n";
import { localTestMailboxEnabled, LOCAL_TEST_MAILBOX_URL } from "../localTestMailbox";
import { validateEmail } from "../utils/emailValidator";
import {rememberReviewIntent} from '../reviewReturn';

const PENDING_VERIFICATION_KEY = "cashback_pending_verification";
const RETURN_PATH_KEY = "cashback_post_auth_next";

interface PendingVerification extends RegisterResult {
  email: string;
}

/**
 * Разрешаем возвращаться только в разделы магазина и бонусов.
 * Внешние адреса и произвольные маршруты не принимаем.
 */
export function safeReturnPath(value: string | null): string | null {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    value.split("").some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
  ) {
    return null;
  }

  try {
    const url = new URL(value, window.location.origin);

    if (url.origin !== window.location.origin) {
      return null;
    }

    const allowed =
      url.pathname === "/forum/reviews/new" ||
      url.pathname === "/forum" ||
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
    title: "Confirm your email",
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
    title: "Подтвердите электронную почту",
    sent: "Мы отправили ссылку для подтверждения на адрес",
    pending: "Ожидается подтверждение почты",
    notSent:
      "Аккаунт создан, но письмо не удалось отправить. Попробуйте запросить письмо ещё раз.",
    demo:
      "Тестовый режим: откройте письмо по ссылке ниже. В рабочем режиме письмо приходит на ваш адрес.",
    preview: "Открыть тестовое письмо",
    resend: "Отправить письмо повторно",
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
    checkVerification,
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

  const [form, setForm] = useState(() => ({ ...readDraft(), password: "" }));

  useEffect(() => { if (!user && !pending) saveDraft(form); }, [form, user, pending]);

  const [termsAccepted, setTermsAccepted] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false);
  const [marketingRequested, setMarketingRequested] = useState(false);
  const [error, setError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resendMessage, setResendMessage] = useState("");

  const language = lang.toUpperCase();
  const t =
    translations[language as keyof typeof translations] ??
    translations.EN;

  const ui = (text:string) => (registrationUi[lang.toLowerCase() as keyof typeof registrationUi] as Record<string,string> | undefined)?.[text] ?? text;
  const v = language === "RU" ? verifyText.ru : Object.fromEntries(Object.entries(verifyText.en).map(([key,text])=>[key,ui(text)])) as typeof verifyText.en;
  const legal = t.registrationLegal;

  useEffect(() => {
    if (!requestedReturnPath) return;
    if(requestedReturnPath==='/forum/reviews/new')rememberReviewIntent();

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

  // Данные текущего аккаунта имеют приоритет
  // над сохранённым адресом.
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
      email.trim() ? ui(validateEmail(email).error || "") : ""
    );
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (busy) return;

    setError("");
    setResendMessage("");

    if (!ageConfirmed) {
      setError(legal.ageError);
      return;
    }

    if (!privacyAcknowledged) {
      setError(legal.privacyError);
      return;
    }

    if (!termsAccepted) {
      setError(t.mustAcceptTerms);
      return;
    }

    const validation = validateEmail(form.email);

    if (!validation.valid) {
      setEmailError(ui(validation.error || "Invalid email"));
      return;
    }

    if (!isFormValid) { setError(language === "RU" ? "Проверьте имя, фамилию, телефон и требования к паролю." : ui("Check names, phone and password requirements.")); return; }
    setBusy(true);

    try {
      const result = await register({
        name: `${form.firstName.trim()} ${form.lastName.trim()}`,
        firstName: form.firstName.trim(), lastName: form.lastName.trim(),
        phone_e164: canonicalPhone(form.phone,form.country)!,
        email: form.email.trim().toLowerCase(),
        password: form.password,
      });

      const pendingVerification: PendingVerification = {
        ...result,
        email: form.email.trim().toLowerCase(),
      };

      clearDraft();
      savePendingVerification(pendingVerification);
      setPending(pendingVerification);

      // Пароль нигде не сохраняем.
      setForm((previous) => ({ ...previous, password: "" }));

      // Не пропускаем подтверждение почты.
      // Переход для подтверждённого аккаунта выполняется ниже.
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t.loginRegister
      );
    } finally {
      setBusy(false);
    }
  };

  const handleCheck = async () => {
    if (busy) return;
    setBusy(true); setError(""); setResendMessage("");
    try {
      if (!await checkVerification()) setResendMessage(language === "RU"
        ? "Почта ещё не подтверждена. Откройте письмо и нажмите ссылку подтверждения."
        : ui("Your email is not verified yet. Open the confirmation link in your email."));
    } catch { setError(language === "RU" ? "Не удалось проверить статус. Попробуйте позже или войдите в аккаунт." : ui("Could not check verification. Retry later or log in.")); }
    finally { setBusy(false); }
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
          : ui("Could not resend verification email")
      );
    } finally {
      setBusy(false);
    }
  };

  const isFormValid = Boolean(
    form.firstName.trim().length >= 2 && form.lastName.trim().length >= 2 &&
      Boolean(canonicalPhone(form.phone, form.country)) &&
      passwordChecks(form.password).every(Boolean) &&
      ageConfirmed && privacyAcknowledged && termsAccepted &&
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
    return <section aria-live="polite" style={{maxWidth: 560, margin: "48px auto", padding: 32, background: "white", borderRadius: 12}}>
      <h1>{language === "RU" ? "Электронная почта подтверждена!" : ui("Email verified!")}</h1>
      <p>{language === "RU" ? "Перейдите в профиль и завершите регистрацию." : ui("Continue to your profile to complete registration.")}</p>
      <Link to="/profile" style={{...buttonStyle, display: "inline-block", textDecoration: "none"}}>{language === "RU" ? "Перейти в профиль" : ui("Continue to profile")}</Link>
    </section>;
  }

  return (
    <div
      style={{
        minHeight: "calc(100vh - 72px)",
        background: "linear-gradient(to bottom, #f5e8d3, #e3d2b8)",
      }}
    >
      <div className="register-layout">
          <Link className="register-back-link"
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

        <div className="register-form-column">

          <div className="register-card">
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

                {localTestMailboxEnabled() && (
                  <aside aria-label={language === "RU" ? "Локальная тестовая почта" : ui("Local test mailbox")}
                    style={{padding: 18, border: "2px solid #0d6efd", borderRadius: 10, background: "#eef5ff"}}>
                    <strong>{language === "RU" ? "Где найти письмо в локальной версии" : ui("Where to find your local test message")}</strong>
                    <p>{language === "RU"
                      ? "Это локальная версия Cashback+. Письма перехватываются тестовой почтой и не приходят в ваш обычный ящик. Откройте письмо для указанного выше адреса и нажмите «Подтвердить почту». Затем вернитесь сюда и нажмите «Проверить подтверждение»."
                      : ui("This is local Cashback+. Messages arrive in the test mailbox, not your personal inbox. Open the message addressed to your email and click its confirmation link. Then return here and check the status.")}</p>

                  </aside>
                )}

                <p style={{ margin: 0 }}>{v.note}</p>
                {marketingRequested && <p role="status">{legal.notSaved}</p>}

                {resendMessage && (
                  <p role="status" style={{ margin: 0 }}>
                    {resendMessage}
                  </p>
                )}

                {localTestMailboxEnabled() ? (
                  <a href={LOCAL_TEST_MAILBOX_URL} target="_blank" rel="noopener noreferrer"
                    style={{...buttonStyle, textAlign: "center", textDecoration: "none"}}>
                    {language === "RU" ? "Проверить почту" : ui("Check email")}
                  </a>
                ) : (
                  <button type="button" style={buttonStyle} onClick={() => setResendMessage(language === "RU"
                    ? "Откройте свой почтовый ящик в приложении или на сайте почтового провайдера. Найдите письмо Cashback+ и перейдите по ссылке подтверждения. Если письма нет, проверьте папку «Спам». Затем вернитесь сюда и нажмите «Проверить подтверждение»."
                    : ui("Open your inbox in your email app or on your email provider's website. Find the Cashback+ message and follow its confirmation link. If it is missing, check Spam. Then return here and select Check verification."))}>
                    {language === "RU" ? "Проверить почту" : ui("Check email")}
                  </button>
                )}
                <button type="button" onClick={handleCheck} disabled={busy} style={buttonStyle}>
                  {busy ? v.waiting : language === "RU" ? "Проверить подтверждение" : ui("Check verification")}
                </button>
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
                <p>{language === "RU" ? "Маркетинговые сообщения необязательны и отключены по умолчанию. После создания аккаунта их можно настроить здесь или в профиле. Сервисные письма и согласие с условиями сайта — отдельно." : ui("Marketing is optional and off by default. After creating your account you can choose preferences here or in your profile. Service messages and site terms are separate.")} <Link to="/privacy#privacySection5">{language === "RU" ? "Подробнее" : ui("Learn more")}</Link></p>
                <form className="register-form" onSubmit={submit}>
                  <div className="register-name-fields">
                  {(["firstName","lastName"] as const).map((field) => <input key={field} id={field} name={field} type="text" aria-label={language === "RU" ? (field === "firstName" ? "Имя" : "Фамилия") : (field === "firstName" ? ui("First name") : ui("Last name"))} placeholder={language === "RU" ? (field === "firstName" ? "Имя" : "Фамилия") : (field === "firstName" ? ui("First name") : ui("Last name"))} value={form[field]} onChange={e=>setForm({...form,[field]:e.target.value})} required minLength={2} maxLength={100} autoComplete={field === "firstName" ? "given-name" : "family-name"} disabled={busy} style={inputStyle}/>)}
                  </div>

                  <div className="register-field-row">
                  <div>
                    <label htmlFor="email">{t.email}</label>
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

                  <PhoneInput id="phone" country={form.country} onCountry={country=>setForm({...form,country})} value={form.phone} onChange={phone=>setForm({...form,phone})} label={language === "RU" ? "Телефон" : ui("Phone")} countryLabel={language === "RU" ? "Страна" : ui("Country")} locale={lang} disabled={busy} error={form.phone && !canonicalPhone(form.phone,form.country) ? (language === "RU" ? "Введите корректный номер для выбранной страны" : ui("Enter a valid number for the selected country")) : undefined}/>
                  </div>
                  <div className="register-field-row">
                  <div>
                    <label htmlFor="password">{t.password}</label>
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
                    minLength={8}
                    autoComplete="new-password"
                    disabled={busy}
                    style={inputStyle}
                  />

                  </div>
                  <div className="register-password-strength" role="status" aria-live="polite"><strong>{language === "RU" ? "Надёжность пароля" : ui("Password strength")}: {passwordChecks(form.password).filter(Boolean).length}/5</strong><ul>{(language === "RU" ? ["Не менее 8 символов","Заглавная латинская буква","Строчная латинская буква","Цифра","Специальный символ"] : [ui("At least 8 characters"),ui("Uppercase Latin letter"),ui("Lowercase Latin letter"),ui("Digit"),ui("Special character")]).map((label,i)=><li key={label}>{passwordChecks(form.password)[i] ? "✓" : "○"} {label}</li>)}</ul></div>
                  </div>
                  <fieldset className="register-consent">
                    <legend>{legal.mandatory}</legend>
                    <div className="register-confirmations">
                      <label className="register-consent-option" htmlFor="age-confirmed"><input id="age-confirmed" type="checkbox" required checked={ageConfirmed} onChange={e=>setAgeConfirmed(e.target.checked)} disabled={busy} /> {legal.age}</label>
                      <div className="register-consent-option">
                        <input id="terms" type="checkbox" required checked={termsAccepted} onChange={e=>setTermsAccepted(e.target.checked)} disabled={busy} />
                        <label htmlFor="terms"> {legal.termsBefore}<Link to="/terms" target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()}>{legal.termsLink}</Link>{legal.termsAfter}</label>
                      </div>
                      <div className="register-consent-option">
                        <input id="privacy-acknowledged" type="checkbox" required checked={privacyAcknowledged} onChange={e=>setPrivacyAcknowledged(e.target.checked)} disabled={busy} />
                        <label htmlFor="privacy-acknowledged"> {legal.privacyBefore}<Link to="/privacy" target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()}>{legal.privacyLink}</Link>{legal.privacyAfter}</label>
                      </div>
                    </div>
                  </fieldset>
                  <fieldset className="register-consent">
                    <legend>{legal.optional}</legend>
                    <label className="register-consent-option" htmlFor="marketing-requested"><input id="marketing-requested" type="checkbox" checked={marketingRequested} onChange={e=>setMarketingRequested(e.target.checked)} disabled={busy} aria-describedby="marketing-withdraw marketing-not-saved" /> {legal.marketing}</label>
                    <p id="marketing-withdraw">{legal.withdraw}</p>
                    <p id="marketing-not-saved">{legal.notSaved}</p>
                  </fieldset>
                  <p className="register-nature">{legal.nature}</p>

                  <button className="register-submit"
                    type="submit"
                    disabled={busy || !isFormValid}
                    style={{
                      ...buttonStyle,
                      opacity: busy || !isFormValid ? 0.6 : 1,
                    }}
                  >
                    {busy ? t.creating : t.register}
                  </button>
                  <div className="register-legal-notes">
                    <p>{legal.dataBefore}<Link to="/privacy" target="_blank" rel="noopener noreferrer">{legal.dataLink}</Link>{legal.dataAfter}</p>
                    <p>{legal.accuracy}</p>
                    <p>{legal.rewards}</p>
                  </div>
                </form>

                <p className="register-login-link">
                  {t.haveAccount}{" "}
                  <Link to={loginPath}>{t.login}</Link>
                </p>
              </>
            )}
          </div>
        </div>

        <div className="register-illustration">
          <div className="register-illustration-content">
            <MoneyTree />
          </div>
        </div>
        {user && verification && <div className="register-marketing"><MarketingPreferencesPanel key={user.id} lang={lang} hasPhone={Boolean(user.phone_e164)} /></div>}
      </div>
    </div>
  );
}
