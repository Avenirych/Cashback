import React from "react";
import { useNavigate } from "react-router-dom";
import LanguageSwitcher from "./LanguageSwitcher";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LangContext";
import { translations } from "../i18n";

export default function Header() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { lang } = useLang();
  const t = translations[lang];
  const isAuth = Boolean(user);

  return (
    <header
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "20px 40px",
        borderBottom: "1px solid var(--sidebar-border)",
      }}
    >
      <div
        style={{ fontSize: "26px", fontWeight: 700, cursor: "pointer" }}
        onClick={() => navigate("/")}
      >
        Cashback+
      </div>

      <nav style={{ display: "flex", gap: "24px", fontSize: "15px" }}>
        <span onClick={() => navigate("/catalog")} style={{ cursor: "pointer" }}>
          {t.menuCatalog}
        </span>
        <span onClick={() => navigate("/partners")} style={{ cursor: "pointer" }}>
          {t.menuPartners}
        </span>
        <span onClick={() => navigate("/offers")} style={{ cursor: "pointer" }}>
          {t.menuOffers}
        </span>
        <span onClick={() => navigate("/terms")} style={{ cursor: "pointer" }}>
          {t.menuTerms}
        </span>
      </nav>

      <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
        <LanguageSwitcher />

        <button
          onClick={() => navigate("/register")}
          style={{
            padding: "10px 18px",
            borderRadius: "10px",
            background: "#0078ff",
            color: "white",
            border: "none",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: 600,
          }}
        >
          {isAuth ? t.profile : t.loginRegister}
        </button>
      </div>
    </header>
  );
}
