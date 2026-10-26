import React from "react";
import {activityText} from './ActivityLimits';
import { Link } from "react-router-dom";
import { translations } from "../i18n";
import {openCookieSettings} from '../cookieConsent';
import {cookieMessages} from '../content/cookieMessages';

interface FooterProps {
  lang: string;
  linkLabels?: { terms: string; contacts: string };
}

export default function Footer({ lang, linkLabels }: FooterProps) {
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
          <button type="button" onClick={openCookieSettings}>{(cookieMessages[lang?.toLowerCase() as keyof typeof cookieMessages] ?? cookieMessages.en).manage}</button>
          <Link to="/activity-limits">{activityText(lang).rules}</Link>
        </div>
      </nav>
      <div style={{ marginBottom: "10px" }}>
        <Link to="/terms" style={{ marginRight: "20px" }}>
          {linkLabels?.terms ?? t.terms ?? "Terms"}
        </Link>
        <Link to="/contacts">{linkLabels?.contacts ?? t.contacts ?? "Contacts"}</Link>
      </div>

      <div style={{ fontSize: "14px", color: "#555" }}>
        © 2026 Cashback+
      </div>
    </footer>
  );
}
