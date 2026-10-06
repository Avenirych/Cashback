import React from "react";
import Footer from "../components/Footer";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { translations } from "../i18n";

interface WelcomeProps {
  lang: string;
}

export default function Welcome({ lang }: WelcomeProps) {
  const { user, loading } = useAuth();
  const isAuth = Boolean(user);
  const navigate = useNavigate();

  const t = (translations as any)[lang?.toUpperCase()] ?? translations.EN;

  const goToShopping = () => {
    if (loading) return;
    if (!isAuth) return navigate("/register");
    navigate("/shop");
  };

  const goToBonuses = () => {
    if (loading) return;
    if (!isAuth) return navigate("/register");
    navigate(user?.bonusEligible === true ? "/bonuses" : "/profile");
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
          padding: "20px 24px",
          gap: "40px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ maxWidth: "520px", flex: "1 1 320px", minWidth: 0 }}>
          <h1 style={{ fontSize: "40px", fontWeight: 700, marginBottom: "20px" }}>
            {t.title ?? "Welcome"}
          </h1>

          <p style={{ fontSize: "18px", lineHeight: 1.6, marginBottom: "30px" }}>
            {t.description ?? "Enjoy your visit!"}
          </p>

          <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
            <button
              disabled={loading}
              onClick={goToShopping}
              style={{ padding: "14px 24px", background: "#0078ff", color: "white", borderRadius: "12px", border: "none", cursor: "pointer", fontSize: "16px", fontWeight: 600 }}
            >
              {t.goShopping ?? "Go shopping"}
            </button>

            <button
              disabled={loading}
              onClick={goToBonuses}
              style={{ padding: "14px 24px", background: user?.bonusEligible === true ? "#167246" : "#a33422", color: "white", borderRadius: "12px", border: "none", cursor: loading ? "wait" : "pointer", fontSize: "16px", fontWeight: 600 }}
            >
              {t.getBonuses ?? "Get bonuses"}
            </button>
          </div>
          <p role="status">
            {loading ? t.creating : user?.bonusEligible === true ? t.bonusReady : t.bonusNotReady}
          </p>

          {!loading && !isAuth && (
            <p style={{ marginTop: "16px", fontSize: "14px", color: "var(--text-secondary)" }}>
              {t.needRegister ?? "Please register to continue"}
            </p>
          )}
        </div>

        <div style={{ maxWidth: "420px", flex: "1 1 300px", minWidth: 0, position: "relative" }}>
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
