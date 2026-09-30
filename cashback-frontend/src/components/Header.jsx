import React from "react";
import { Link } from "react-router-dom";
import Coint1 from "../assets/Coint 1.png"; // логотип

export default function Header() {
  return (
    <header
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 24px",
        background: "var(--bg)",
        borderBottom: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      {/* LOGO + TITLE */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
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
      <nav
        style={{
          display: "flex",
          alignItems: "center",
          gap: "24px",
        }}
      >
        <Link to="/catalog" style={navLinkStyle}>
          Покупки
        </Link>

        <Link to="/bonuses" style={navLinkStyle}>
          Бонусы
        </Link>

        <Link to="/profile" style={navLinkStyle}>
          Профиль
        </Link>
      </nav>
    </header>
  );
}

const navLinkStyle = {
  color: "var(--text)",
  textDecoration: "none",
  fontSize: "16px",
  fontWeight: 500,
};
