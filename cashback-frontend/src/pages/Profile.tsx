import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LanguageContext";
import "./Profile.css";

const PROFILE_URL = "http://localhost:3001/auth/profile";

type ProfileLang = "en" | "ru" | "de" | "fr";

interface ProfileMessages {
  title: string;
  loading: string;
  guestTitle: string;
  guestText: string;
  login: string;
  register: string;
  name: string;
  email: string;
  balance: string;
  notSpecified: string;
  demoNotice: string;
  home: string;
  shop: string;
  avatarAlt: string;
  wiseCredentials: string;
  fullName: string;
  currency: string;
  accountType: string;
  wiseEmail: string;
  selectOption: string;
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
  wiseNotice: string;
}

export const messages: Record<ProfileLang, ProfileMessages> = {
  en: {
    title: "Profile",
    loading: "Loading profile...",
    guestTitle: "You are not logged in",
    guestText: "Log in or register to see your profile.",
    login: "Log in",
    register: "Register",
    name: "Name",
    email: "Email",
    balance: "Balance",
    notSpecified: "Not specified",
    demoNotice:
      "Demo mode: the balance is shown for development and testing only. No real payments or partner payouts are made.",
    home: "Home",
    shop: "Shop",
    avatarAlt: "User avatar",
    wiseCredentials: "Wise Business credentials",
    fullName: "Full Name",
    currency: "Currency",
    accountType: "Account Type",
    wiseEmail: "Wise Account Email",
    selectOption: "Select an option",
    personal: "Personal",
    business: "Business",
    saveCredentials: "Save Credentials",
    enroll: "Enroll in Program",
    credentialsSaved: "Credentials saved",
    enrolled: "You are enrolled",
    enrollmentDate: "Enrollment date",
    required: "All fields required",
    invalidEmail: "Invalid email format",
    storageError: "Unable to save in this browser. Please try again.",
    wiseNotice:
      "Development mode: partner services and real payments are not connected. Wise credentials are stored only in this browser and are not sent to any service.",
  },
  ru: {
    title: "Профиль",
    loading: "Загрузка профиля...",
    guestTitle: "Вы не вошли в систему",
    guestText: "Войдите или зарегистрируйтесь, чтобы увидеть свой профиль.",
    login: "Войти",
    register: "Зарегистрироваться",
    name: "Имя",
    email: "Email",
    balance: "Баланс",
    notSpecified: "Не указано",
    demoNotice:
      "Демо-режим: баланс показан только для разработки и тестирования. Реальные платежи и выплаты партнёров не производятся.",
    home: "Главная",
    shop: "Магазин",
    avatarAlt: "Аватар пользователя",
    wiseCredentials: "Реквизиты Wise Business",
    fullName: "ФИО",
    currency: "Валюта",
    accountType: "Тип аккаунта",
    wiseEmail: "Email аккаунта Wise",
    selectOption: "Выберите вариант",
    personal: "Личный",
    business: "Бизнес",
    saveCredentials: "Сохранить реквизиты",
    enroll: "Присоединиться к программе",
    credentialsSaved: "Реквизиты сохранены",
    enrolled: "Вы участник программы",
    enrollmentDate: "Дата присоединения",
    required: "Все поля обязательны",
    invalidEmail: "Неверный формат email",
    storageError: "Не удалось сохранить данные в браузере. Попробуйте ещё раз.",
    wiseNotice:
      "Режим разработки: партнёрские сервисы и реальные платежи не подключены. Реквизиты Wise хранятся только в этом браузере и никуда не отправляются.",
  },
  de: {
    title: "Profil",
    loading: "Profil wird geladen...",
    guestTitle: "Sie sind nicht angemeldet",
    guestText: "Melden Sie sich an oder registrieren Sie sich, um Ihr Profil zu sehen.",
    login: "Anmelden",
    register: "Registrieren",
    name: "Name",
    email: "E-Mail",
    balance: "Guthaben",
    notSpecified: "Nicht angegeben",
    demoNotice:
      "Demo-Modus: Das Guthaben wird nur zu Entwicklungs- und Testzwecken angezeigt. Es erfolgen keine echten Zahlungen oder Partnerauszahlungen.",
    home: "Startseite",
    shop: "Shop",
    avatarAlt: "Benutzeravatar",
    wiseCredentials: "Wise-Business-Kontodaten",
    fullName: "Vollständiger Name",
    currency: "Währung",
    accountType: "Kontotyp",
    wiseEmail: "E-Mail des Wise-Kontos",
    selectOption: "Option auswählen",
    personal: "Privat",
    business: "Geschäftlich",
    saveCredentials: "Kontodaten speichern",
    enroll: "Am Programm teilnehmen",
    credentialsSaved: "Kontodaten gespeichert",
    enrolled: "Sie nehmen am Programm teil",
    enrollmentDate: "Teilnahmedatum",
    required: "Alle Felder sind erforderlich",
    invalidEmail: "Ungültiges E-Mail-Format",
    storageError: "Speichern im Browser nicht möglich. Bitte versuchen Sie es erneut.",
    wiseNotice:
      "Entwicklungsmodus: Partnerdienste und echte Zahlungen sind nicht verbunden. Wise-Kontodaten werden nur in diesem Browser gespeichert und an keinen Dienst gesendet.",
  },
  fr: {
    title: "Profil",
    loading: "Chargement du profil...",
    guestTitle: "Vous n'êtes pas connecté",
    guestText: "Connectez-vous ou inscrivez-vous pour voir votre profil.",
    login: "Se connecter",
    register: "S'inscrire",
    name: "Nom",
    email: "E-mail",
    balance: "Solde",
    notSpecified: "Non renseigné",
    demoNotice:
      "Mode démo : le solde est affiché uniquement pour le développement et les tests. Aucun paiement réel ni versement de partenaire n'est effectué.",
    home: "Accueil",
    shop: "Boutique",
    avatarAlt: "Avatar de l'utilisateur",
    wiseCredentials: "Coordonnées Wise Business",
    fullName: "Nom complet",
    currency: "Devise",
    accountType: "Type de compte",
    wiseEmail: "E-mail du compte Wise",
    selectOption: "Sélectionnez une option",
    personal: "Personnel",
    business: "Professionnel",
    saveCredentials: "Enregistrer les coordonnées",
    enroll: "Rejoindre le programme",
    credentialsSaved: "Coordonnées enregistrées",
    enrolled: "Vous êtes inscrit",
    enrollmentDate: "Date d'inscription",
    required: "Tous les champs sont obligatoires",
    invalidEmail: "Format d'e-mail invalide",
    storageError: "Impossible d'enregistrer dans ce navigateur. Veuillez réessayer.",
    wiseNotice:
      "Mode développement : les services partenaires et les paiements réels ne sont pas connectés. Les coordonnées Wise sont conservées uniquement dans ce navigateur et ne sont envoyées à aucun service.",
  },
};

export function getMessages(lang: string | undefined): ProfileMessages {
  const key = (lang || "en").toLowerCase() as ProfileLang;
  return messages[key] || messages.en;
}

// PostgreSQL decimal columns may arrive as strings (e.g. "12.50").
export function formatBalance(value: unknown): string {
  const num =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
      ? Number(value)
      : 0;
  return (Number.isFinite(num) ? num : 0).toFixed(2);
}

interface ProfileData {
  email?: string;
  name?: string;
  avatar_url?: string | null;
  balance?: unknown;
}

interface WiseForm {
  fullName: string;
  email: string;
  currency: string;
  accountType: string;
  wiseEmail: string;
}

const emptyWiseForm: WiseForm = {
  fullName: "",
  email: "",
  currency: "",
  accountType: "",
  wiseEmail: "",
};
const wiseKey = "cashback_wise_data";
const enrollmentKey = "cashback_program_enrolled";

function validateWiseForm(data: WiseForm) {
  const errors: Partial<Record<keyof WiseForm, "required" | "invalidEmail">> = {};
  (Object.keys(emptyWiseForm) as (keyof WiseForm)[]).forEach((field) => {
    if (!data[field].trim()) errors[field] = "required";
  });
  (["email", "wiseEmail"] as const).forEach((field) => {
    if (data[field].trim() && !/^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(data[field].trim())) {
      errors[field] = "invalidEmail";
    }
  });
  if (!["EUR", "GBP", "USD"].includes(data.currency)) errors.currency = "required";
  if (!["Personal", "Business"].includes(data.accountType)) errors.accountType = "required";
  return errors;
}

function readLocalData(key: string, userId: number) {
  try {
    const raw = localStorage.getItem(`${key}:${userId}`) ?? localStorage.getItem(key);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data && typeof data === "object" &&
      (data.userId === undefined || data.userId === userId) ? data : null;
  } catch {
    return null;
  }
}

function saveLocalData(key: string, userId: number, data: object) {
  const serialized = JSON.stringify({ ...data, userId });
  // Keep the requested key visible, with per-account copies for shared browsers.
  localStorage.setItem(`${key}:${userId}`, serialized);
  localStorage.setItem(key, serialized);
}

function WiseEnrollment({ userId, lang }: { userId: number; lang: string }) {
  const t = getMessages(lang);
  const [savedData] = useState(() => readLocalData(wiseKey, userId));
  const [formData, setFormData] = useState<WiseForm>(() => {
    const data = { ...emptyWiseForm };
    (Object.keys(data) as (keyof WiseForm)[]).forEach((field) => {
      if (typeof savedData?.[field] === "string") data[field] = savedData[field];
    });
    return data;
  });
  const [isFormFilled, setIsFormFilled] = useState(() =>
    Object.keys(validateWiseForm(formData)).length === 0
  );
  const [enrolledAt, setEnrolledAt] = useState<string | null>(() => {
    const date = readLocalData(enrollmentKey, userId)?.enrolledAt;
    return typeof date === "string" && Number.isFinite(Date.parse(date)) ? date : null;
  });
  const [showErrors, setShowErrors] = useState(false);
  const [storageFailed, setStorageFailed] = useState(false);
  const errors = validateWiseForm(formData);
  const isFormValid = Object.keys(errors).length === 0;
  const readonly = isFormFilled || !!enrolledAt;

  function handleSaveCredentials(event: React.FormEvent) {
    event.preventDefault();
    setShowErrors(true);
    if (!isFormValid || readonly) return;
    const data = { ...formData };
    (Object.keys(data) as (keyof WiseForm)[]).forEach((field) => {
      data[field] = data[field].trim();
    });
    try {
      saveLocalData(wiseKey, userId, { ...data, savedAt: new Date().toISOString() });
      setFormData(data);
      setIsFormFilled(true);
      setStorageFailed(false);
    } catch {
      setStorageFailed(true);
    }
  }

  function handleEnroll() {
    if (!isFormFilled || !isFormValid || enrolledAt) return;
    const date = new Date().toISOString();
    try {
      saveLocalData(enrollmentKey, userId, { enrolledAt: date });
      setEnrolledAt(date);
      setStorageFailed(false);
    } catch {
      setStorageFailed(true);
    }
  }

  function updateField(field: keyof WiseForm, value: string) {
    setFormData((data) => ({ ...data, [field]: value }));
    setShowErrors(true);
  }

  function fieldError(field: keyof WiseForm) {
    const error = showErrors && !readonly && errors[field];
    return error ? <p id={`wise-${field}-error`} role="alert">{t[error]}</p> : null;
  }

  function fieldProps(field: keyof WiseForm) {
    const invalid = !!(showErrors && !readonly && errors[field]);
    return {
      id: `wise-${field}`,
      name: field,
      value: formData[field],
      required: true,
      "aria-invalid": invalid,
      "aria-describedby": invalid ? `wise-${field}-error` : undefined,
      onBlur: () => setShowErrors(true),
      onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
        updateField(field, event.target.value),
    };
  }

  return (
    <section aria-label={t.wiseCredentials}>
      <form onSubmit={handleSaveCredentials} noValidate>
        <fieldset>
          <legend>{t.wiseCredentials}</legend>
          {(["fullName", "email", "wiseEmail"] as const).map((field) => (
            <div key={field}>
              <label htmlFor={`wise-${field}`}>{t[field]}</label>
              <input {...fieldProps(field)} type={field === "fullName" ? "text" : "email"}
                readOnly={readonly} />
              {fieldError(field)}
            </div>
          ))}
          <div>
            <label htmlFor="wise-currency">{t.currency}</label>
            <select {...fieldProps("currency")} disabled={readonly}>
              <option value="">{t.selectOption}</option>
              {["EUR", "GBP", "USD"].map((currency) => (
                <option key={currency} value={currency}>{currency}</option>
              ))}
            </select>
            {fieldError("currency")}
          </div>
          <div>
            <label htmlFor="wise-accountType">{t.accountType}</label>
            <select {...fieldProps("accountType")} disabled={readonly}>
              <option value="">{t.selectOption}</option>
              <option value="Personal">{t.personal}</option>
              <option value="Business">{t.business}</option>
            </select>
            {fieldError("accountType")}
          </div>
        </fieldset>
        {!readonly && <button type="submit" disabled={!isFormValid}>{t.saveCredentials}</button>}
      </form>
      {storageFailed && <p role="alert">{t.storageError}</p>}
      {enrolledAt ? (
        <p role="status">
          {t.enrolled}. {t.enrollmentDate}:{" "}
          <time dateTime={enrolledAt}>
            {new Date(enrolledAt).toLocaleDateString(getMessages(lang) === messages.en ? "en" : lang)}
          </time>
        </p>
      ) : (
        <>
          {isFormFilled && <p role="status">{t.credentialsSaved}</p>}
          <button type="button" onClick={handleEnroll} disabled={!isFormFilled}>{t.enroll}</button>
        </>
      )}
      <p>{t.wiseNotice}</p>
    </section>
  );
}

export default function Profile() {
  const { user, loading, token } = useAuth();
  const { lang } = useLang();
  const t = getMessages(lang);
  const [freshProfile, setFreshProfile] = useState<ProfileData | null>(null);

  useEffect(() => {
    if (!token) {
      setFreshProfile(null);
      return;
    }

    const controller = new AbortController();
    fetch(PROFILE_URL, {
      headers: { Authorization: "Bearer " + token },
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setFreshProfile(data);
      })
      .catch(() => {
        // Keep showing the user data from the auth context.
      });

    return () => controller.abort();
  }, [token]);

  if (loading) {
    return (
      <main className="profile-container">
        <p role="status" aria-live="polite">
          {t.loading}
        </p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="profile-container" aria-labelledby="profile-guest-title">
        <h1 id="profile-guest-title">{t.guestTitle}</h1>
        <p>{t.guestText}</p>
        <nav className="profile-links" aria-label={t.title}>
          <Link to="/login">{t.login}</Link>
          <Link to="/register">{t.register}</Link>
        </nav>
      </main>
    );
  }

  const profile: ProfileData = { ...user, ...(freshProfile || {}) };

  return (
    <main className="profile-container" aria-labelledby="profile-title">
      <h1 id="profile-title">{t.title}</h1>

      <section className="profile-card">
        {profile.avatar_url && (
          <img className="profile-avatar" src={profile.avatar_url} alt={t.avatarAlt} />
        )}

        <dl className="profile-details">
          <div className="profile-row">
            <dt>{t.name}</dt>
            <dd data-testid="profile-name">{profile.name || t.notSpecified}</dd>
          </div>
          <div className="profile-row">
            <dt>{t.email}</dt>
            <dd data-testid="profile-email">{profile.email || t.notSpecified}</dd>
          </div>
          <div className="profile-row">
            <dt>{t.balance}</dt>
            <dd data-testid="profile-balance">{formatBalance(profile.balance)}</dd>
          </div>
        </dl>
      </section>

      <WiseEnrollment key={user.id} userId={user.id} lang={lang} />

      <p className="profile-demo-notice" role="note">
        {t.demoNotice}
      </p>

      <nav className="profile-links" aria-label={t.title}>
        <Link to="/">{t.home}</Link>
        <Link to="/shop">{t.shop}</Link>
      </nav>
    </main>
  );
}
