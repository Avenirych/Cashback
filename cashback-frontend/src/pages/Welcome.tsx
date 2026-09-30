import React from "react";
import Coint1 from "../assets/Coint1.png"; // ✔ исправленный путь (без пробела)
import { t, setLanguage, currentLanguage } from "../api";

const Welcome: React.FC = () => {
  return (
    <div
      style={{
        fontFamily: "sans-serif",
        maxWidth: "900px",
        margin: "0 auto",
        padding: "20px",
      }}
    >
      {/* HEADER */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "30px",
        }}
      >
        {/* LOGO INSTEAD OF TEXT */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <img
            src={Coint1}
            alt={t("logoAlt")}
            title={t("logoTooltip")}
            style={{
              width: "48px",
              height: "48px",
              objectFit: "contain",
            }}
          />

          <span
            style={{
              fontSize: "22px",
              fontWeight: 700,
            }}
          >
            {t("logoTitle")}
          </span>
        </div>

        {/* LANGUAGE SWITCHER */}
        <select
          value={currentLanguage}
          onChange={(e) => setLanguage(e.target.value as "EN" | "RU")}
          style={{
            padding: "6px 10px",
            fontSize: "14px",
          }}
        >
          <option value="EN">EN</option>
          <option value="RU">RU</option>
        </select>
      </header>

      {/* MAIN CONTENT */}
      <h1>{t("title")}</h1>

      <p style={{ fontSize: "18px", marginBottom: "10px" }}>
        {t("description")}
      </p>

      <p style={{ fontSize: "18px", marginBottom: "20px" }}>
        {t("everythingFine")}
      </p>

      <div style={{ display: "flex", gap: "15px", marginBottom: "20px" }}>
        <button style={{ padding: "10px 20px", fontSize: "16px" }}>
          {t("goShopping")}
        </button>

        <button style={{ padding: "10px 20px", fontSize: "16px" }}>
          {t("getBonuses")}
        </button>
      </div>

      <p style={{ color: "#888", marginBottom: "40px" }}>
        {t("needRegister")}
      </p>

      {/* FOOTER */}
      <footer
        style={{
          borderTop: "1px solid #ddd",
          paddingTop: "20px",
          marginTop: "40px",
          fontSize: "14px",
          color: "#666",
        }}
      >
        © 2026 Cashback+ — {t("footerPrivacy")} • {t("footerTerms")}
      </footer>
    </div>
  );
};

export default Welcome; // ✔ default export
