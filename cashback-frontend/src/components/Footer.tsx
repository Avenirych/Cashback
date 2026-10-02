import React from "react";
import { useLang } from "../context/LangContext";
import { translations } from "../i18n";

export default function Footer() {
  const { lang } = useLang();
  const t = translations[lang?.toUpperCase()] ?? translations["EN"];

  return (
    <footer
      style={{
        borderTop: "1px solid var(--sidebar-border)",
        padding: "20px 40px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontSize: "14px",
        color: "var(--text-secondary)",
      }}
    >
      <span>{t.footerPrivacy}</span>
      <span>{t.footerTerms}</span>
    </footer>
  );
}
