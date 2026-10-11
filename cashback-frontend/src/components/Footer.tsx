import React from "react";
import { Link } from "react-router-dom";
import { translations } from "../i18n";

interface FooterProps {
  lang: string;
}

const footerLabels: Record<
  string,
  { faq: string; privacy: string; contacts: string }
> = {
  EN: {
    faq: "FAQ",
    privacy: "Privacy Policy",
    contacts: "Contacts",
  },
  RU: {
    faq: "Частые вопросы",
    privacy: "Политика конфиденциальности",
    contacts: "Контакты",
  },
  DE: {
    faq: "Häufige Fragen",
    privacy: "Datenschutz",
    contacts: "Kontakt",
  },
  FR: {
    faq: "Questions fréquentes",
    privacy: "Politique de Confidentialité",
    contacts: "Contact",
  },
};

export default function Footer({ lang }: FooterProps) {
  const normalizedLang = (lang || "EN").toUpperCase();
  const languageKey = normalizedLang as keyof typeof translations;

  const t = translations[languageKey] ?? translations.EN;
  const labels =
    footerLabels[normalizedLang] ?? footerLabels.EN;

  return (
    <footer
      style={{
        padding: "20px",
        background: "rgba(0,0,0,0.05)",
        textAlign: "center",
        marginTop: "40px",
      }}
    >
      <nav
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "center",
          gap: "12px 20px",
          marginBottom: "10px",
        }}
      >
        <Link to="/faq">{labels.faq}</Link>
        <Link to="/privacy">{labels.privacy}</Link>
        <Link to="/terms">{t.footerTerms}</Link>
        <Link to="/contacts">{labels.contacts}</Link>
      </nav>

      <div style={{ fontSize: "14px", color: "#555" }}>
        © 2026 Cashback+
      </div>
    </footer>
  );
}