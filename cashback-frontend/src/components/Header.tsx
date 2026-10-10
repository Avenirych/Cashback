import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Coint1 from "../assets/Coint1.png";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LanguageContext";
import { forumAvatarUrl } from "../forum";
import LanguageSwitcher from "./LanguageSwitcher";

const labels: Record<string, Record<string, string>> = {
  en: {
    about: "About us",
    how: "How it works",
    shop: "Shop",
    forum: "Forum",
    login: "Login / Register",
    profile: "Profile",
    dashboard: "Dashboard",
    logout: "Logout",
  },
  ru: {
    about: "О нас",
    how: "Как это работает",
    shop: "Магазин",
    forum: "Форум",
    login: "Вход / Регистрация",
    profile: "Профиль",
    dashboard: "Личный кабинет",
    logout: "Выйти",
  },
  de: {
    about: "Über uns",
    how: "So funktioniert's",
    shop: "Shop",
    forum: "Forum",
    login: "Anmelden / Registrieren",
    profile: "Profil",
    dashboard: "Dashboard",
    logout: "Abmelden",
  },
  fr: {
    about: "À propos",
    how: "Comment ça marche",
    shop: "Boutique",
    forum: "Forum",
    login: "Connexion / Inscription",
    profile: "Profil",
    dashboard: "Tableau de bord",
    logout: "Déconnexion",
  },
};

export default function Header() {
  const { user, forumUser, logout } = useAuth();
  const { lang } = useLang();
  const navigate = useNavigate();

  const [menuOpen, setMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const [failedAvatar, setFailedAvatar] = useState<string | null>(null);

  useEffect(() => {
    if (!menuOpen) return;

    const handleOutsidePress = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Node &&
        !profileMenuRef.current?.contains(target)
      ) {
        setMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handleOutsidePress);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handleOutsidePress);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [menuOpen]);

  const t = labels[lang.toLowerCase()] ?? labels.en;

  const avatar = forumAvatarUrl(
    forumUser?.avatar_url || user?.avatar_url
  );

  const showAvatar = Boolean(avatar && avatar !== failedAvatar);

  const initials =
    (user?.name || "U")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => Array.from(part)[0] || "")
      .join("")
      .toUpperCase() || "U";

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
    setFailedAvatar(null);
    navigate("/");
  };

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
      <Link
        to="/"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          textDecoration: "none",
        }}
      >
        <img
          src={Coint1}
          alt="Cashback+ Logo"
          className="coin-spin"
          style={{
            height: "48px",
            width: "48px",
            objectFit: "contain",
          }}
        />
        <span
          style={{
            fontSize: "22px",
            fontWeight: 700,
            color: "var(--text, #000)",
          }}
        >
          Cashback+
        </span>
      </Link>

      {/* NAVIGATION */}
      <nav
        style={{
          display: "flex",
          alignItems: "center",
          gap: "24px",
        }}
      >
        <Link to="/about" style={navLinkStyle}>
          {t.about}
        </Link>
        <Link to="/services" style={navLinkStyle}>
          {t.how}
        </Link>
        <Link to="/shop" style={navLinkStyle}>
          {t.shop}
        </Link>
        <Link to="/forum" style={navLinkStyle}>
          {t.forum}
        </Link>
      </nav>

      {/* RIGHT PANEL */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "16px",
        }}
      >
        <LanguageSwitcher />

        {!user && (
          <button
            type="button"
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
          <div ref={profileMenuRef} style={{ position: "relative" }}>
            <button
              type="button"
              title={user.name}
              aria-label={`${t.profile}: ${user.name}`}
              aria-expanded={menuOpen}
              aria-controls={menuOpen ? "header-profile-menu" : undefined}
              onClick={() => setMenuOpen((previous) => !previous)}
              style={{
                width: "46px",
                height: "46px",
                boxSizing: "border-box",
                padding: 0,
                borderRadius: "50%",
                overflow: "hidden",
                cursor: "pointer",
                border: "2px solid rgba(255,255,255,0.7)",
                background: "#0d6efd",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "16px",
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {showAvatar ? (
                <img
                  src={avatar}
                  alt=""
                  onError={() => setFailedAvatar(avatar ?? null)}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              ) : (
                <span aria-hidden="true">{initials}</span>
              )}
            </button>

            {menuOpen && (
              <div
                id="header-profile-menu"
                style={{
                  position: "absolute",
                  top: "54px",
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
                <div style={{ fontWeight: 700 }}>
                  {user.name}
                </div>

                <div
                  style={{
                    fontSize: "12px",
                    color: "#666",
                    overflowWrap: "anywhere",
                  }}
                >
                  {user.email}
                </div>

                <Link
                  to="/dashboard"
                  onClick={() => setMenuOpen(false)}
                  style={menuLinkStyle}
                >
                  {t.dashboard}
                </Link>

                <Link
                  to="/profile"
                  onClick={() => setMenuOpen(false)}
                  style={menuLinkStyle}
                >
                  {t.profile}
                </Link>

                <button
                  type="button"
                  onClick={handleLogout}
                  style={{
                    ...menuLinkStyle,
                    background: "none",
                    border: "none",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
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