import React from "react";
import { useNavigate } from "react-router-dom";
import Footer from "../components/Footer";
import { translations } from "../i18n";

interface WelcomeProps {
  lang: string;
}

export default function Welcome({ lang }: WelcomeProps) {
  const navigate = useNavigate();

  const normalizedLang = (lang || "EN").toUpperCase();
  const languageKey = normalizedLang as keyof typeof translations;
  const t = translations[languageKey] ?? translations.EN;

  const goToShopping = () => {
    navigate("/shop");
  };

  const goToBonuses = () => {
    navigate("/bonuses");
  };

  return (
    <div
      style={{
        minHeight: "calc(100vh - 72px)",
        display: "flex",
        flexDirection: "column",
        background: "linear-gradient(to bottom, #f5e8d3, #e3d2b8)",
        color: "var(--text)",
        fontFamily: "Segoe UI, system-ui, sans-serif",
      }}
    >
      <main
        style={{
          flex: 1,
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "flex-start",
          padding: "20px clamp(16px, 4vw, 40px)",
          gap: "clamp(24px, 6vw, 80px)",
        }}
      >
        <div
          style={{
            flex: "1 1 280px",
            maxWidth: "520px",
            minWidth: 0,
          }}
        >
          <h1
            style={{
              fontSize: "clamp(28px, 5vw, 40px)",
              fontWeight: 700,
              marginBottom: "20px",
            }}
          >
            {t.title}
          </h1>

          <p
            style={{
              fontSize: "18px",
              lineHeight: 1.6,
              marginBottom: "30px",
            }}
          >
            {t.description}
          </p>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "20px",
            }}
          >
            <button
              type="button"
              onClick={goToShopping}
              style={{
                padding: "14px 24px",
                background: "#0078ff",
                color: "white",
                borderRadius: "12px",
                border: "none",
                cursor: "pointer",
                fontSize: "16px",
                fontWeight: 600,
              }}
            >
              {t.goShopping}
            </button>

            <button
              type="button"
              onClick={goToBonuses}
              style={{
                padding: "14px 24px",
                background: "#ff3b3b",
                color: "white",
                borderRadius: "12px",
                border: "none",
                cursor: "pointer",
                fontSize: "16px",
                fontWeight: 600,
              }}
            >
              {t.getBonuses}
            </button>
          </div>
        </div>

        <div
          style={{
            flex: "1 1 280px",
            maxWidth: "420px",
            minWidth: 0,
            position: "relative",
          }}
        >
          <img
            src="/assets/Oduvanchiki.jpeg"
            alt={
              normalizedLang === "RU"
                ? "Одуванчики"
                : "Dandelions"
            }
            style={{
              display: "block",
              width: "100%",
              borderRadius: "20px",
              boxShadow: "0 12px 32px rgba(0,0,0,0.15)",
              objectFit: "cover",
            }}
          />

          <div
            style={{
              position: "absolute",
              bottom: "12px",
              right: "16px",
              left: "16px",
              textAlign: "right",
              color: "white",
              fontSize: "22px",
              fontFamily: "'Brush Script MT', cursive",
              textShadow: "0 0 6px rgba(0,0,0,0.6)",
            }}
          >
            {t.everythingFine}
          </div>
        </div>
      </main>

      <Footer lang={normalizedLang} />
    </div>
  );
}