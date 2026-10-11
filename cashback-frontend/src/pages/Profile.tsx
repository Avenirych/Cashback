import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LanguageContext";

import Footer from "../components/Footer";
import MarketingPreferencesPanel from "../components/MarketingPreferencesPanel";

import {
  emptyWiseForm,
  enrollInProgram,
  getOnboardingMessages,
  saveCredentials,
  useOnboarding,
  validUserId,
  validateWiseForm,
} from "../onboarding";

import type { WiseForm } from "../onboarding";

interface ProfileMessages {
  title: string;
  loading: string;
  guestTitle: string;
  guestDescription: string;
  login: string;
  register: string;
  home: string;
  shop: string;
  name: string;
  email: string;
  balance: string;
  notSet: string;
  demoNotice: string;
  wiseCredentials: string;
  fullName: string;
  wiseEmail: string;
  currency: string;
  accountType: string;
  choose: string;
  personal: string;
  business: string;
  saveCredentials: string;
  enroll: string;
  credentialsSaved: string;
  enrolled: string;
  enrollmentDate: string;
  required: string;
  invalidEmail: string;
  storageError: string;
  invalidIdentity: string;
  wiseNotice: string;
  marketing: string;
  privacy: string;
  terms: string;
}

export const messages: Record<
  "en" | "ru" | "de" | "fr",
  ProfileMessages
> = {
  en: {
    title: "Profile",
    loading: "Loading...",
    guestTitle: "Your account",
    guestDescription: "Log in or register to view your profile.",
    login: "Login",
    register: "Register",
    home: "Home",
    shop: "Go shopping",
    name: "Name",
    email: "Email",
    balance: "Balance",
    notSet: "Not set",
    demoNotice:
      "Demo: the Wise form and program enrollment are stored only in this browser. They do not open a Wise account, authorise a payment or confirm enrollment with an external provider.",
    wiseCredentials: "Wise details and program enrollment",
    fullName: "Full name",
    wiseEmail: "Wise email",
    currency: "Currency",
    accountType: "Account type",
    choose: "Select an option",
    personal: "Personal",
    business: "Business",
    saveCredentials: "Save details",
    enroll: "Join the program",
    credentialsSaved: "Details saved.",
    enrolled: "You have joined the demo program.",
    enrollmentDate: "Enrollment date",
    required: "This field is required.",
    invalidEmail: "Enter a valid email address.",
    storageError:
      "Unable to save changes in this browser. Please try again.",
    invalidIdentity:
      "Unable to verify your account identity. Sign in again.",
    wiseNotice:
      "Do not enter passwords, card numbers or bank account credentials. These details are a browser-only demo and are not sent to Wise.",
    marketing: "Email and marketing preferences",
    privacy: "Privacy & Data Protection Policy",
    terms: "Terms of Use",
  },

  ru: {
    title: "Профиль",
    loading: "Загрузка...",
    guestTitle: "Ваш аккаунт",
    guestDescription:
      "Войдите или зарегистрируйтесь, чтобы открыть профиль.",
    login: "Вход",
    register: "Регистрация",
    home: "На главную",
    shop: "Перейти к покупкам",
    name: "Имя",
    email: "Email",
    balance: "Баланс",
    notSet: "Не указано",
    demoNotice:
      "Демо: анкета Wise и участие в программе сохраняются только в этом браузере. Они не открывают аккаунт Wise, не разрешают выплату и не подтверждают участие у внешнего провайдера.",
    wiseCredentials: "Данные Wise и участие в программе",
    fullName: "Полное имя",
    wiseEmail: "Email аккаунта Wise",
    currency: "Валюта",
    accountType: "Тип аккаунта",
    choose: "Выберите вариант",
    personal: "Личный",
    business: "Бизнес",
    saveCredentials: "Сохранить данные",
    enroll: "Присоединиться к программе",
    credentialsSaved: "Данные сохранены.",
    enrolled: "Вы присоединились к демонстрационной программе.",
    enrollmentDate: "Дата подключения",
    required: "Обязательное поле.",
    invalidEmail: "Введите корректный email.",
    storageError:
      "Не удалось сохранить изменения в браузере. Попробуйте снова.",
    invalidIdentity:
      "Не удалось проверить идентификатор аккаунта. Войдите повторно.",
    wiseNotice:
      "Не вводите пароли, номера карт или банковские реквизиты доступа. Это демонстрационная анкета в браузере; данные не отправляются в Wise.",
    marketing: "Предпочтения email и маркетинга",
    privacy: "Политика конфиденциальности и защиты данных",
    terms: "Условия использования",
  },

  de: {
    title: "Profil",
    loading: "Wird geladen...",
    guestTitle: "Ihr Konto",
    guestDescription:
      "Melden Sie sich an oder registrieren Sie sich, um Ihr Profil zu öffnen.",
    login: "Anmelden",
    register: "Registrieren",
    home: "Startseite",
    shop: "Einkaufen",
    name: "Name",
    email: "E-Mail",
    balance: "Guthaben",
    notSet: "Nicht angegeben",
    demoNotice:
      "Demo: Das Wise-Formular und die Programmteilnahme werden nur in diesem Browser gespeichert. Dadurch wird kein Wise-Konto eröffnet, keine Zahlung autorisiert und keine Teilnahme bei einem externen Anbieter bestätigt.",
    wiseCredentials: "Wise-Angaben und Programmteilnahme",
    fullName: "Vollständiger Name",
    wiseEmail: "Wise-E-Mail",
    currency: "Währung",
    accountType: "Kontotyp",
    choose: "Bitte auswählen",
    personal: "Privat",
    business: "Geschäftlich",
    saveCredentials: "Angaben speichern",
    enroll: "Am Programm teilnehmen",
    credentialsSaved: "Angaben gespeichert.",
    enrolled: "Sie nehmen am Demoprogramm teil.",
    enrollmentDate: "Teilnahmedatum",
    required: "Dieses Feld ist erforderlich.",
    invalidEmail: "Geben Sie eine gültige E-Mail-Adresse ein.",
    storageError:
      "Änderungen konnten nicht im Browser gespeichert werden. Versuchen Sie es erneut.",
    invalidIdentity:
      "Ihre Kontoidentität konnte nicht überprüft werden. Melden Sie sich erneut an.",
    wiseNotice:
      "Geben Sie keine Passwörter, Kartennummern oder Bankzugangsdaten ein. Dieses Demoformular bleibt im Browser; die Angaben werden nicht an Wise gesendet.",
    marketing: "E-Mail- und Marketing-Einstellungen",
    privacy: "Datenschutzrichtlinie",
    terms: "Nutzungsbedingungen",
  },

  fr: {
    title: "Profil",
    loading: "Chargement...",
    guestTitle: "Votre compte",
    guestDescription:
      "Connectez-vous ou inscrivez-vous pour consulter votre profil.",
    login: "Connexion",
    register: "Inscription",
    home: "Accueil",
    shop: "Faire du shopping",
    name: "Nom",
    email: "E-mail",
    balance: "Solde",
    notSet: "Non renseigné",
    demoNotice:
      "Démo : le formulaire Wise et la participation au programme sont enregistrés uniquement dans ce navigateur. Ils ne créent pas de compte Wise, n’autorisent aucun paiement et ne confirment aucune participation auprès d’un prestataire externe.",
    wiseCredentials: "Informations Wise et participation au programme",
    fullName: "Nom complet",
    wiseEmail: "E-mail Wise",
    currency: "Devise",
    accountType: "Type de compte",
    choose: "Sélectionnez une option",
    personal: "Personnel",
    business: "Professionnel",
    saveCredentials: "Enregistrer les informations",
    enroll: "Rejoindre le programme",
    credentialsSaved: "Informations enregistrées.",
    enrolled: "Vous avez rejoint le programme de démonstration.",
    enrollmentDate: "Date d’adhésion",
    required: "Ce champ est obligatoire.",
    invalidEmail: "Saisissez une adresse e-mail valide.",
    storageError:
      "Impossible d’enregistrer les modifications dans le navigateur. Réessayez.",
    invalidIdentity:
      "Impossible de vérifier votre compte. Reconnectez-vous.",
    wiseNotice:
      "Ne saisissez aucun mot de passe, numéro de carte ou identifiant bancaire. Ce formulaire est une démo locale ; les informations ne sont pas envoyées à Wise.",
    marketing: "Préférences e-mail et marketing",
    privacy: "Politique de confidentialité et de protection des données",
    terms: "Conditions d’utilisation",
  },
};

export function getMessages(lang?: string): ProfileMessages {
  const key = (lang || "en").toLowerCase();

  switch (key) {
    case "ru":
      return messages.ru;
    case "de":
      return messages.de;
    case "fr":
      return messages.fr;
    default:
      return messages.en;
  }
}

export function formatBalance(value: unknown): string {
  if (typeof value !== "number" && typeof value !== "string") {
    return "0.00";
  }

  const number = Number(value);

  return Number.isFinite(number) ? number.toFixed(2) : "0.00";
}

interface DisplayProfile {
  id: number;
  name?: string | null;
  email?: string | null;
  balance?: unknown;
}

function parseProfile(
  value: unknown,
  expectedUserId: number,
): DisplayProfile | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const data = value as Record<string, unknown>;

  if (data.id !== expectedUserId) {
    return null;
  }

  return {
    id: expectedUserId,
    name: typeof data.name === "string" ? data.name : undefined,
    email: typeof data.email === "string" ? data.email : undefined,
    balance: data.balance,
  };
}

const fields: Array<keyof WiseForm> = [
  "fullName",
  "email",
  "wiseEmail",
  "currency",
  "accountType",
];

const cardStyle: React.CSSProperties = {
  padding: "24px",
  background: "#fff",
  border: "1px solid #ddd",
  borderRadius: "12px",
  marginBottom: "24px",
};

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  boxSizing: "border-box",
  padding: "12px",
  marginTop: "6px",
  border: "1px solid #aaa",
  borderRadius: "6px",
  fontFamily: "inherit",
  fontSize: "16px",
};

const buttonStyle: React.CSSProperties = {
  padding: "12px 20px",
  border: "none",
  borderRadius: "8px",
  background: "#0078ff",
  color: "#fff",
  fontSize: "16px",
  fontFamily: "inherit",
  cursor: "pointer",
};

export default function Profile() {
  const { lang } = useLang();
  const { user, token, loading } = useAuth();

  const language = (lang || "en").toLowerCase();
  const t = getMessages(language);
  const onboardingText = getOnboardingMessages(language);

  const onboarding = useOnboarding();
  const userId = user?.id;

  const [freshProfile, setFreshProfile] =
    useState<DisplayProfile | null>(null);

  const [form, setForm] = useState<WiseForm>({
    ...emptyWiseForm,
  });

  const [showValidation, setShowValidation] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [marketingOpen, setMarketingOpen] = useState(false);

  // Стабильная строка позволяет реагировать на изменения данных,
  // не сбрасывая набранную форму при каждом рендере.
  const storedForm = JSON.stringify(onboarding.form);

  useEffect(() => {
    setForm(JSON.parse(storedForm) as WiseForm);
    setShowValidation(false);
    setStorageError(false);
  }, [userId, storedForm, onboarding.credentialsSaved]);

  useEffect(() => {
    setMarketingOpen(false);
  }, [userId, token]);

  useEffect(() => {
    setFreshProfile(null);

    if (loading || !validUserId(userId) || !token) {
      return;
    }

    let cancelled = false;

    const fetchProfile = async () => {
      try {
        const response = await fetch(
          "http://localhost:3001/auth/profile",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (!response.ok) {
          return;
        }

        const data: unknown = await response.json();
        const parsed = parseProfile(data, userId);

        if (!cancelled && parsed) {
          setFreshProfile(parsed);
        }
      } catch {
        // При ошибке сохраняем данные из AuthContext.
      }
    };

    void fetchProfile();

    return () => {
      cancelled = true;
    };
  }, [userId, token, loading]);

  const errors = validateWiseForm(form);
  const validIdentity = validUserId(userId);
  const validForm = Object.keys(errors).length === 0;
  const readonly = onboarding.credentialsSaved;

  const changeField = (field: keyof WiseForm, value: string) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));

    setShowValidation(true);
    setStorageError(false);
  };

  const handleSave = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setShowValidation(true);
    setStorageError(false);

    if (
      !validIdentity ||
      !validForm ||
      readonly
    ) {
      return;
    }

    try {
      saveCredentials(userId, form);
    } catch {
      setStorageError(true);
    }
  };

  const handleEnroll = () => {
    setStorageError(false);

    if (!validIdentity) {
      return;
    }

    try {
      // Helper повторно проверяет сохранённые данные.
      enrollInProgram(userId);
    } catch {
      setStorageError(true);
    }
  };

  if (loading) {
    return (
      <main style={{ padding: "40px 20px", textAlign: "center" }}>
        <p role="status">{t.loading}</p>
      </main>
    );
  }

  if (!user) {
    return (
      <div
        style={{
          minHeight: "calc(100vh - 72px)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <main style={{ flex: 1, padding: "40px 20px" }}>
          <h1>{t.guestTitle}</h1>
          <p>{t.guestDescription}</p>

          <nav
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "20px",
            }}
          >
            <Link to="/login">{t.login}</Link>
            <Link to="/register">{t.register}</Link>
          </nav>
        </main>

        <Footer lang={language} />
      </div>
    );
  }

  const contextProfile = user as unknown as DisplayProfile;

  const displayedProfile =
    freshProfile?.id === userId
      ? freshProfile
      : contextProfile;

  const fieldError = (field: keyof WiseForm) => {
    if (!showValidation || readonly) {
      return undefined;
    }

    return errors[field];
  };

  const renderError = (field: keyof WiseForm) => {
    const error = fieldError(field);

    if (!error) {
      return null;
    }

    return (
      <p
        id={`wise-${field}-error`}
        role="alert"
        style={{
          margin: "6px 0 0",
          color: "#b71c1c",
          fontSize: "14px",
        }}
      >
        {t[error]}
      </p>
    );
  };

  const renderField = (field: keyof WiseForm) => {
    const id = `wise-${field}`;
    const error = fieldError(field);

    const accessibility = {
      id,
      "aria-invalid": error ? true : undefined,
      "aria-describedby": error
        ? `${id}-error`
        : undefined,
    };

    return (
      <div key={field}>
        <label htmlFor={id}>{t[field]}</label>

        {field === "currency" ? (
          <select
            {...accessibility}
            value={form.currency}
            disabled={readonly}
            onBlur={() => setShowValidation(true)}
            onChange={(event) =>
              changeField(field, event.target.value)
            }
            style={inputStyle}
          >
            <option value="">{t.choose}</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
            <option value="USD">USD</option>
          </select>
        ) : field === "accountType" ? (
          <select
            {...accessibility}
            value={form.accountType}
            disabled={readonly}
            onBlur={() => setShowValidation(true)}
            onChange={(event) =>
              changeField(field, event.target.value)
            }
            style={inputStyle}
          >
            <option value="">{t.choose}</option>
            <option value="Personal">{t.personal}</option>
            <option value="Business">{t.business}</option>
          </select>
        ) : (
          <input
            {...accessibility}
            type={
              field === "email" || field === "wiseEmail"
                ? "email"
                : "text"
            }
            value={form[field]}
            readOnly={readonly}
            autoComplete={field === "fullName" ? "name" : "email"}
            onBlur={() => setShowValidation(true)}
            onChange={(event) =>
              changeField(field, event.target.value)
            }
            style={inputStyle}
          />
        )}

        {renderError(field)}
      </div>
    );
  };

  return (
    <div
      style={{
        minHeight: "calc(100vh - 72px)",
        display: "flex",
        flexDirection: "column",
        background: "#f7f7f7",
      }}
    >
      <main
        style={{
          flex: 1,
          width: "100%",
          maxWidth: "900px",
          boxSizing: "border-box",
          margin: "0 auto",
          padding: "32px 20px",
        }}
      >
        <h1>{t.title}</h1>

        <nav
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "20px",
            marginBottom: "24px",
          }}
        >
          <Link to="/">{t.home}</Link>
          <Link to="/shop">{t.shop}</Link>
        </nav>

        <section style={cardStyle}>
          <dl style={{ margin: 0 }}>
            <dt style={{ fontWeight: 600 }}>{t.name}</dt>
            <dd
              data-testid="profile-name"
              style={{ margin: "6px 0 18px" }}
            >
              {displayedProfile.name || t.notSet}
            </dd>

            <dt style={{ fontWeight: 600 }}>{t.email}</dt>
            <dd
              data-testid="profile-email"
              style={{
                margin: "6px 0 18px",
                overflowWrap: "anywhere",
              }}
            >
              {displayedProfile.email || t.notSet}
            </dd>

            <dt style={{ fontWeight: 600 }}>{t.balance}</dt>
            <dd
              data-testid="profile-balance"
              style={{ margin: "6px 0 0" }}
            >
              {formatBalance(displayedProfile.balance)}
            </dd>
          </dl>
        </section>

        <p
          role="note"
          style={{
            padding: "16px",
            background: "#fff3cd",
            borderRadius: "8px",
            lineHeight: 1.6,
          }}
        >
          {t.demoNotice}
        </p>

        <p style={{ lineHeight: 1.6 }}>
          {onboardingText.explanation}
        </p>

        <form onSubmit={handleSave} noValidate>
          <fieldset
            style={{
              ...cardStyle,
              minWidth: 0,
            }}
          >
            <legend
              style={{
                padding: "0 8px",
                fontSize: "20px",
                fontWeight: 600,
              }}
            >
              {t.wiseCredentials}
            </legend>

            <p style={{ lineHeight: 1.6 }}>
              {t.wiseNotice}
            </p>

            {!validIdentity && (
              <p role="alert" style={{ color: "#b71c1c" }}>
                {t.invalidIdentity}
              </p>
            )}

            <div
              style={{
                display: "grid",
                gap: "18px",
              }}
            >
              {fields.map(renderField)}
            </div>

            {storageError && (
              <p role="alert" style={{ color: "#b71c1c" }}>
                {t.storageError}
              </p>
            )}

            {onboarding.credentialsSaved && (
              <div
                role="status"
                style={{
                  marginTop: "20px",
                  padding: "14px",
                  background: "#e8f5e9",
                  borderRadius: "8px",
                  lineHeight: 1.6,
                }}
              >
                {onboarding.enrolledAt ? (
                  <>
                    <p style={{ margin: "0 0 6px" }}>
                      {t.enrolled}
                    </p>

                    <p style={{ margin: 0 }}>
                      {t.enrollmentDate}:{" "}
                      <time dateTime={onboarding.enrolledAt}>
                        {new Date(
                          onboarding.enrolledAt,
                        ).toLocaleDateString(
                          ["en", "ru", "de", "fr"].includes(language)
                            ? language
                            : "en",
                        )}
                      </time>
                    </p>
                  </>
                ) : (
                  t.credentialsSaved
                )}
              </div>
            )}

            {!onboarding.eligible && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "12px",
                  marginTop: "20px",
                }}
              >
                {!readonly && (
                  <button
                    type="submit"
                    disabled={!validIdentity || !validForm}
                    style={{
                      ...buttonStyle,
                      opacity:
                        validIdentity && validForm ? 1 : 0.5,
                      cursor:
                        validIdentity && validForm
                          ? "pointer"
                          : "not-allowed",
                    }}
                  >
                    {t.saveCredentials}
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleEnroll}
                  disabled={
                    !validIdentity ||
                    !onboarding.credentialsSaved
                  }
                  style={{
                    ...buttonStyle,
                    background: "#287d3c",
                    opacity:
                      validIdentity &&
                      onboarding.credentialsSaved
                        ? 1
                        : 0.5,
                    cursor:
                      validIdentity &&
                      onboarding.credentialsSaved
                        ? "pointer"
                        : "not-allowed",
                  }}
                >
                  {t.enroll}
                </button>
              </div>
            )}
          </fieldset>
        </form>

        {validIdentity && token && (
          <details
            key={`${userId}:${token}`}
            open={marketingOpen}
            onToggle={(event) => {
              setMarketingOpen(event.currentTarget.open);
            }}
            style={cardStyle}
          >
            <summary
              style={{
                cursor: "pointer",
                fontSize: "18px",
                fontWeight: 600,
              }}
            >
              {t.marketing}
            </summary>

            {marketingOpen && (
              <div style={{ marginTop: "20px" }}>
                <MarketingPreferencesPanel
                  key={userId}
                  lang={language.toUpperCase()}
                />
              </div>
            )}
          </details>
        )}

        <nav
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          <Link to="/privacy">{t.privacy}</Link>
          <Link to="/terms">{t.terms}</Link>
        </nav>
      </main>

      <Footer lang={language} />
    </div>
  );
}