import React from "react";
import { useNavigate } from "react-router-dom";
import { useLang } from "../context/LangContext";
import { translations } from "../i18n";

export default function Footer() {
  const navigate = useNavigate();
  const { lang } = useLang();
  const t = translations[lang];

  return (
    <footer
      style={{
        padding: "20px 40px",
        borderTop: "1px solid var(--sidebar-border)",
        display: "flex",
        justifyContent: "space-between",
        fontSize: "14px",
        color: "var(--text-secondary)",
      }}
    >
      <div>© 2026 Cashback+</div>

      <div style={{ display: "flex", gap: "20px" }}>
        <span onClick={() => navigate("/terms")} style={{ cursor: "pointer" }}>
          {t.footerPrivacy}
        </span>
        <span onClick={() => navigate("/terms")} style={{ cursor: "pointer" }}>
          {t.footerTerms}
        </span>
      </div>
    </footer>
  );
}
