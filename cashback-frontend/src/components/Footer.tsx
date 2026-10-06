import React from "react";
import { Link } from "react-router-dom";
import { translations } from "../i18n";

interface FooterProps {
  lang: string;
}

export default function Footer({ lang }: FooterProps) {
  const t = translations[lang?.toUpperCase()] ?? translations["EN"];

  return (
    <footer
      style={{
        padding: "20px",
        background: "rgba(0,0,0,0.05)",
        textAlign: "center",
        marginTop: "40px",
      }}
    >
      <div style={{ marginBottom: "10px" }}>
        <Link to="/terms" style={{ marginRight: "20px" }}>
          {t.footerTerms}
        </Link>
        <Link to="/contacts">{t.contacts ?? "Contacts"}</Link>
        {" · "}
        <Link to="/privacy">{t.footerPrivacy}</Link>
      </div>

      <div style={{ fontSize: "14px", color: "#555" }}>
        © 2026 Cashback+
      </div>
    </footer>
  );
}
