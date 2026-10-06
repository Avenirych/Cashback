import React from "react";
import { Link } from "react-router-dom";
import { useLang } from "../context/LanguageContext";
import { translations } from "../i18n";
import "./Profile.css";

export default function ProgrammeDraft({ privacy = false }: { privacy?: boolean }) {
  const { lang } = useLang();
  const t = translations[lang.toUpperCase() as keyof typeof translations] ?? translations.EN;
  return (
    <main className="profile-container">
      <h1>{privacy ? t.onboarding.privacy : t.onboarding.terms}</h1>
      <p>{t.onboarding.draft}</p>
      <p>{privacy ? t.onboarding.privacyBody : t.onboarding.termsBody}</p>
      <p>{t.onboarding.intro}</p>
      <p>{t.onboarding.capture}</p>
      <Link to={privacy ? "/programme" : "/privacy"}>
        {privacy ? t.onboarding.terms : t.onboarding.privacy}
      </Link>
      <p><Link to="/">{t.backToHome}</Link></p>
    </main>
  );
}
