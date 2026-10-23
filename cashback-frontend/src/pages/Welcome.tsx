import {labels,locale} from '../content/siteContent';
import React from "react";
import Footer from "../components/Footer";
import { useNavigate } from "react-router-dom";
import { translations } from "../i18n";
import ReviewsCarousel, {reviewDisplayMode} from "../components/ReviewsCarousel";
import './WelcomeHero.css';

interface WelcomeProps {
  lang: string;
}

export default function Welcome({ lang }: WelcomeProps) {
  const navigate = useNavigate();

  const t =
    translations[lang.toUpperCase() as keyof typeof translations] ??
    translations.EN;

  // Просмотр магазина не требует регистрации.
  const goToShopping = () => {
    navigate("/shop");
  };

  // Просмотр раздела бонусов не требует регистрации.
  // Проверки авторизации и анкеты должны оставаться
  // непосредственно при запуске рекламы/исследования.
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
        className="welcome-hero"
        style={{
          flex: 1,
        }}
      >
        <div className="welcome-copy">
          <h1
            style={{
              fontSize: "40px",
              fontWeight: 700,
              marginBottom: "20px",
            }}
          >
            {t.title ?? "Welcome"}
          </h1>

          <p
            style={{
              fontSize: "18px",
              lineHeight: 1.6,
              marginBottom: "30px",
            }}
          >
            {t.description ?? "Enjoy your visit!"}
          </p>

          <aside className="feature-notice"><strong>{labels.status[locale(lang)]}</strong><p>{labels.demo[locale(lang)]}</p></aside>
          <div className="welcome-actions" style={{ display: "flex", gap: "20px" }}>
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
              {t.goShopping ?? "Go shopping"}
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
              {t.getBonuses ?? "Get bonuses"}
            </button>
          </div>
        </div>

        <div className="welcome-art">
          <img
            src="/assets/Oduvanchiki.jpeg"
            alt={labels.decorative[locale(lang)]}
            style={{
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
              color: "white",
              fontSize: "22px",
              fontFamily: "'Brush Script MT', cursive",
              textShadow: "0 0 6px rgba(0,0,0,0.6)",
            }}
          >
            {t.everythingFine ?? "Everything will be fine"}
          </div>
        </div>
      </main>

      <ReviewsCarousel mode={reviewDisplayMode(process.env.REACT_APP_REVIEWS_MODE)} />
      <Footer lang={lang} />
    </div>
  );
}
