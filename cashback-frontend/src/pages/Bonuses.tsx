import React from "react";
import { useNavigate } from "react-router-dom";
import { useLang } from "../context/LanguageContext";

const messages = {
  RU: {
    title: "Получение бонусов",
    description: "Выберите способ получения бонусов:",
    video: "Смотреть рекламу",
    research: "Участвовать в исследованиях",
  },
  EN: {
    title: "Get bonuses",
    description: "Choose how to earn bonuses:",
    video: "Watch ads",
    research: "Participate in research",
  },
  DE: {
    title: "Boni erhalten",
    description: "Wählen Sie, wie Sie Boni verdienen möchten:",
    video: "Werbung ansehen",
    research: "An Studien teilnehmen",
  },
  FR: {
    title: "Obtenir des bonus",
    description: "Choisissez comment gagner des bonus :",
    video: "Regarder des publicités",
    research: "Participer à des études",
  },
};

function getMessages(lang: string) {
  switch (lang.toUpperCase()) {
    case "RU":
      return messages.RU;
    case "DE":
      return messages.DE;
    case "FR":
      return messages.FR;
    default:
      return messages.EN;
  }
}

export default function Bonuses() {
  const navigate = useNavigate();
  const { lang } = useLang();
  const t = getMessages(lang);

  const buttonStyle: React.CSSProperties = {
    padding: "16px 24px",
    color: "white",
    borderRadius: "12px",
    border: "none",
    cursor: "pointer",
    fontSize: "18px",
    fontWeight: 600,
  };

  return (
    <main
      style={{
        minHeight: "calc(100vh - 72px)",
        padding: "40px 20px",
        background: "linear-gradient(to bottom, #f5e8d3, #e3d2b8)",
        color: "#173a33",
        fontFamily: "Segoe UI, system-ui, sans-serif",
      }}
    >
      <section
        style={{
          maxWidth: "900px",
          margin: "0 auto",
          padding: "32px 24px",
          borderRadius: "18px",
          background: "rgba(255,255,255,0.85)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
        }}
      >
        <h1
          style={{
            fontSize: "32px",
            margin: "0 0 20px",
          }}
        >
          {t.title}
        </h1>

        <p
          style={{
            fontSize: "18px",
            margin: "0 0 30px",
          }}
        >
          {t.description}
        </p>

        <div
          style={{
            display: "flex",
            gap: "20px",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={() => navigate("/bonuses/ads")}
            style={{
              ...buttonStyle,
              background: "#0078ff",
            }}
          >
            {t.video}
          </button>

          <button
            type="button"
            onClick={() => navigate("/bonuses/research")}
            style={{
              ...buttonStyle,
              background: "#ff3b3b",
            }}
          >
            {t.research}
          </button>
        </div>
      </section>
    </main>
  );
}