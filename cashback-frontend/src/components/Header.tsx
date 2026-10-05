import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Header() {
  const { user, logout } = useAuth();

  const initials =
    user?.name
      ?.split(" ")
      .map((p) => p[0]?.toUpperCase())
      .join("") || "U";

  const navLinkStyle = {
    textDecoration: "none",
    color: "inherit",
    marginLeft: "20px",
    fontSize: "14px",
  };

  return (
    <header
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "16px 24px",
        borderBottom: "1px solid #ddd",
        backgroundColor: "#fff",
      }}
    >
      <Link to="/" style={{ textDecoration: "none", color: "inherit" }}>
        <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 700 }}>Cashback+</h1>
      </Link>

      <nav style={{ display: "flex", alignItems: "center", gap: "0" }}>
        <Link to="/how-it-works" style={navLinkStyle}>
          How It Works
        </Link>
        <Link to="/about" style={navLinkStyle}>
          About
        </Link>
        <Link to="/forum" style={navLinkStyle}>
          Forum
        </Link>

        {user ? (
          <>
            <span style={{ marginLeft: "20px" }}>Welcome, {user.name}!</span>
            <button
              onClick={logout}
              style={{
                marginLeft: "20px",
                padding: "8px 16px",
                backgroundColor: "#dc3545",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/login" style={navLinkStyle}>
              Login
            </Link>
            <Link to="/register" style={navLinkStyle}>
              Register
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
