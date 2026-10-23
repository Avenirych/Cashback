import {labels,locale} from '../content/siteContent';
import React from "react";
import {activityText} from './ActivityLimits';
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
      <nav aria-labelledby="footer-information">
        <h2 id="footer-information" style={{ fontSize: "18px", margin: "0 0 16px" }}>{t.footerInformation}</h2>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "16px", marginBottom: "16px", lineHeight: 1.6 }}>
          <Link to="/privacy">{t.footerPrivacy}</Link>
          <Link to="/faq">{t.footerFaq}</Link>
          <Link to="/cookies">{t.footerCookies}</Link>
          <Link to="/activity-limits">{activityText(lang).rules}</Link>
        </div>
      </nav>
      <div style={{ marginBottom: "10px" }}>
        <Link to="/terms" style={{ marginRight: "20px" }}>
          {labels.terms[locale(lang)]}
        </Link>
        <Link to="/contacts">{labels.contacts[locale(lang)]}</Link>
      </div>

      <div style={{ fontSize: "14px", color: "#555" }}>
        © 2026 Cashback+
      </div>
    </footer>
  );
}
