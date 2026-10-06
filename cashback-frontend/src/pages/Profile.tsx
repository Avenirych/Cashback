import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LanguageContext";
import "./Profile.css";

const PROFILE_URL = "http://localhost:3001/auth/profile";

export const ENROLLED_KEY = "cashback_program_enrolled";
export const ENROLLED_AT_KEY = "cashback_program_enrolled_at";

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
  enroll: string;
  enrolled: string;
  enrolledSince: string;
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
    enroll: "Enroll in Program",
    enrolled: "You are enrolled in the Cashback Program",
    enrolledSince: "Joined program on",
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
    enroll: "Присоединиться к программе",
    enrolled: "Вы участник программы кэшбэка",
    enrolledSince: "Дата вступления в программу",
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
    enroll: "Am Programm teilnehmen",
    enrolled: "Sie nehmen am Cashback-Programm teil",
    enrolledSince: "Dem Programm beigetreten am",
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
    enroll: "Rejoindre le programme",
    enrolled: "Vous êtes inscrit au programme de cashback",
    enrolledSince: "Inscrit au programme le",
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

const DATE_LOCALES: Record<ProfileLang, string> = {
  en: "en-GB",
  ru: "ru-RU",
  de: "de-DE",
  fr: "fr-FR",
};

// Returns a locale-appropriate DD.MM.YYYY-style date, or "" for invalid input.
export function formatEnrollmentDate(value: string | null, lang: string | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const key = (lang || "en").toLowerCase() as ProfileLang;
  return new Intl.DateTimeFormat(DATE_LOCALES[key] || DATE_LOCALES.en, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function readEnrollment(): { enrolled: boolean; enrolledAt: string | null } {
  try {
    return {
      enrolled: localStorage.getItem(ENROLLED_KEY) === "true",
      enrolledAt: localStorage.getItem(ENROLLED_AT_KEY),
    };
  } catch {
    return { enrolled: false, enrolledAt: null };
  }
}

interface ProfileData {
  email?: string;
  name?: string;
  avatar_url?: string | null;
  balance?: unknown;
}

export default function Profile() {
  const { user, loading, token } = useAuth();
  const { lang } = useLang();
  const t = getMessages(lang);
  const [freshProfile, setFreshProfile] = useState<ProfileData | null>(null);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [enrolledAt, setEnrolledAt] = useState<string | null>(null);

  useEffect(() => {
    const stored = readEnrollment();
    setIsEnrolled(stored.enrolled);
    setEnrolledAt(stored.enrolledAt);
  }, []);

  const handleEnroll = () => {
    const now = new Date().toISOString();
    try {
      localStorage.setItem(ENROLLED_KEY, "true");
      localStorage.setItem(ENROLLED_AT_KEY, now);
    } catch {
      // Storage may be unavailable (e.g. blocked); still reflect enrollment for this session.
    }
    setIsEnrolled(true);
    setEnrolledAt(now);
  };

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
  const enrolledDate = formatEnrollmentDate(enrolledAt, lang);

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

      <section className="profile-enrollment" aria-live="polite">
        {isEnrolled ? (
          <div data-testid="profile-enrollment-status">
            <p className="profile-enrollment-message">{t.enrolled}</p>
            {enrolledDate && (
              <p>
                {t.enrolledSince}:{" "}
                <time dateTime={enrolledAt || undefined} data-testid="profile-enrollment-date">
                  {enrolledDate}
                </time>
              </p>
            )}
          </div>
        ) : (
          <button type="button" className="profile-enroll-button" onClick={handleEnroll}>
            {t.enroll}
          </button>
        )}
      </section>

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
