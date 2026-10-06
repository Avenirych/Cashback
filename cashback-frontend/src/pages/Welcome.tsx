import React from "react";
import Footer from "../components/Footer";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { translations } from "../i18n";

interface WelcomeProps {
  lang: string;
}

export default function Welcome({ lang }: WelcomeProps) {
  const { user } = useAuth();
  const isAuth = Boolean(user);
  const navigate = useNavigate();

  const t = (translations as any)[lang?.toUpperCase()] ?? translations.EN;

  const goToShopping = () => {
    if (!isAuth) return navigate("/register");
    navigate("/shop");
  };

  const goToBonuses = () => {
    if (!isAuth) return navigate("/register");
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
          justifyContent: "center",
          alignItems: "flex-start",
          padding: "20px 40px",
          gap: "80px",
        }}
      >
        <div style={{ maxWidth: "520px" }}>
          <h1 style={{ fontSize: "40px", fontWeight: 700, marginBottom: "20px" }}>
            {t.title ?? "Welcome"}
          </h1>

          <p style={{ fontSize: "18px", lineHeight: 1.6, marginBottom: "30px" }}>
            {t.description ?? "Enjoy your visit!"}
          </p>

          <div style={{ display: "flex", gap: "20px" }}>
            <button
              onClick={goToShopping}
              style={{ padding: "14px 24px", background: "#0078ff", color: "white", borderRadius: "12px", border: "none", cursor: "pointer", fontSize: "16px", fontWeight: 600 }}
            >
              {t.goShopping ?? "Go shopping"}
            </button>

            <button
              onClick={goToBonuses}
              style={{ padding: "14px 24px", background: "#ff3b3b", color: "white", borderRadius: "12px", border: "none", cursor: "pointer", fontSize: "16px", fontWeight: 600 }}
            >
              {t.getBonuses ?? "Get bonuses"}
            </button>
          </div>

          {!isAuth && (
            <p style={{ marginTop: "16px", fontSize: "14px", color: "var(--text-secondary)" }}>
              {t.needRegister ?? "Please register to continue"}
            </p>
          )}
        </div>

        <div style={{ maxWidth: "420px", position: "relative" }}>
          <img
            src="/assets/Oduvanchiki.jpeg"
            alt="Oduvanchiki"
            style={{ width: "100%", borderRadius: "20px", boxShadow: "0 12px 32px rgba(0,0,0,0.15)", objectFit: "cover" }}
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

      <Footer lang={lang} />
    </div>
  );
}
