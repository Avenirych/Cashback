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
