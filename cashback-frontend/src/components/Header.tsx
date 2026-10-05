import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Coint1 from "../assets/Coint1.png";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LanguageContext";
import LanguageSwitcher from "./LanguageSwitcher";

const labels: Record<string, Record<string, string>> = {
  en: { about: "About us", how: "How it works", forum: "Forum", login: "Login / Register", profile: "Profile", logout: "Logout" },
  ru: { about: "О нас", how: "Как это работает", forum: "Форум", login: "Вход / Регистрация", profile: "Профиль", logout: "Выйти" },
  de: { about: "Über uns", how: "So funktioniert's", forum: "Forum", login: "Anmelden / Registrieren", profile: "Profil", logout: "Abmelden" },
  fr: { about: "À propos", how: "Comment ça marche", forum: "Forum", login: "Connexion / Inscription", profile: "Profil", logout: "Déconnexion" },
};

export default function Header() {
  const { user, logout } = useAuth();
  const { lang } = useLang();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const t = labels[lang] ?? labels.en;

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
    navigate("/");
  };

  const avatar =
    user?.avatar_url ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || "U")}&background=0d6efd&color=fff`;

  return (
    <header
      style={{
        width: "100%",
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 24px",
        background: "linear-gradient(90deg, #f5e8d3, #e3d2b8, #d9c4a8)",
        borderBottom: "1px solid rgba(0,0,0,0.08)",
      }}
    >
      {/* LOGO */}
      <Link to="/" style={{ display: "flex", alignItems: "center", gap: "12px", textDecoration: "none" }}>
        <img
          src={Coint1}
          alt="Cashback+ Logo"
          className="coin-spin"
          style={{ height: "48px", width: "48px", objectFit: "contain" }}
        />
        <span style={{ fontSize: "22px", fontWeight: 700, color: "var(--text, #000)" }}>Cashback+</span>
      </Link>

      {/* NAVIGATION */}
      <nav style={{ display: "flex", alignItems: "center", gap: "24px" }}>
        <Link to="/about" style={navLinkStyle}>{t.about}</Link>
        <Link to="/services" style={navLinkStyle}>{t.how}</Link>
        <Link to="/forum" style={navLinkStyle}>{t.forum}</Link>
      </nav>

      {/* RIGHT PANEL */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <LanguageSwitcher />

        {!user && (
          <button
            onClick={() => navigate("/login")}
            style={{
              padding: "10px 18px",
              background: "#0078ff",
              color: "white",
              borderRadius: "12px",
              border: "none",
              cursor: "pointer",
              fontSize: "15px",
              fontWeight: 600,
            }}
          >
            {t.login}
          </button>
        )}

        {user && (
          <div style={{ position: "relative" }}>
            <img
              src={avatar}
              alt="avatar"
              title={user.name}
              onClick={() => setMenuOpen(!menuOpen)}
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "50%",
                objectFit: "cover",
                cursor: "pointer",
                border: "2px solid rgba(255,255,255,0.7)",
              }}
            />
            {menuOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "50px",
                  right: 0,
                  background: "white",
                  color: "black",
                  borderRadius: "10px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                  padding: "10px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  minWidth: "170px",
                  zIndex: 100,
                }}
              >
                <div style={{ fontWeight: 700 }}>{user.name}</div>
                <div style={{ fontSize: "12px", color: "#666" }}>{user.email}</div>
                <Link to="/profile" onClick={() => setMenuOpen(false)} style={menuLinkStyle}>{t.profile}</Link>
                <button onClick={handleLogout} style={{ ...menuLinkStyle, background: "none", border: "none", textAlign: "left", cursor: "pointer" }}>
                  {t.logout}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

const navLinkStyle: React.CSSProperties = {
  color: "var(--text, #000)",
  textDecoration: "none",
  fontSize: "16px",
  fontWeight: 500,
};

const menuLinkStyle: React.CSSProperties = {
  color: "black",
  textDecoration: "none",
  fontSize: "15px",
  fontWeight: 500,
  padding: "6px 4px",
};
