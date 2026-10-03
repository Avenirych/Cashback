import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Coint1 from "../assets/Coint1.png";
import { useAuth } from "../context/AuthContext";

interface HeaderProps {
  lang: string;
  setLang: (lang: string) => void;
}

export default function Header({ lang, setLang }: HeaderProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <header
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 24px",
        background: "linear-gradient(90deg, #f5e8d3, #e3d2b8, #d9c4a8)",
        borderBottom: "1px solid rgba(255,255,255,0.2)",
      }}
    >
      {/* LOGO */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <img
          src={Coint1}
          alt="Cashback+ Logo"
          className="coin-spin"
          style={{ height: "48px", width: "48px", objectFit: "contain" }}
        />

        <Link
          to="/"
          style={{
            fontSize: "22px",
            fontWeight: 700,
            color: "var(--text)",
            textDecoration: "none",
          }}
        >
          Cashback+
        </Link>
      </div>

      {/* NAVIGATION */}
      <nav style={{ display: "flex", alignItems: "center", gap: "24px" }}>
        <Link to="/about" style={navLinkStyle}>About us</Link>
        <Link to="/services" style={navLinkStyle}>Services</Link>
        <Link to="/forum" style={navLinkStyle}>Forum</Link>
        <Link to="/contacts" style={navLinkStyle}>Contacts</Link>

        {/* ❌ Terms removed */}
      </nav>

      {/* RIGHT PANEL */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        {/* SEARCH */}
        <input
          type="text"
          placeholder="Search..."
          style={{
            padding: "6px 10px",
            borderRadius: "6px",
            border: "1px solid rgba(255,255,255,0.3)",
            background: "rgba(255,255,255,0.2)",
            color: "var(--text)",
          }}
        />

        {/* LANGUAGE SWITCHER */}
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value)}
          style={{
            padding: "6px 10px",
            borderRadius: "6px",
            background: "rgba(255,255,255,0.2)",
            color: "var(--text)",
            border: "1px solid rgba(255,255,255,0.3)",
          }}
        >
          <option value="en">EN</option>
          <option value="ru">RU</option>
          <option value="de">DE</option>
          <option value="fr">FR</option>
        </select>

        {/* LOGIN BUTTON */}
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
              fontSize: "16px",
              fontWeight: 600,
            }}
          >
            Login / Register
          </button>
        )}

        {/* USER MENU */}
        {user && (
          <div style={{ position: "relative" }}>
            <img
              src={user.avatarUrl || "/assets/default-avatar.png"}
              alt="avatar"
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "50%",
                objectFit: "cover",
                cursor: "pointer",
                border: "2px solid rgba(255,255,255,0.4)",
              }}
              onClick={() => setMenuOpen(!menuOpen)}
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
                  minWidth: "160px",
                  zIndex: 100,
                }}
              >
                <Link to="/profile" style={menuLinkStyle}>Profile</Link>
                <Link to="/cabinet" style={menuLinkStyle}>Cabinet</Link>
                <button
                  onClick={handleLogout}
                  style={{
                    ...menuLinkStyle,
                    background: "none",
                    border: "none",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  Logout
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
  color: "var(--text)",
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
