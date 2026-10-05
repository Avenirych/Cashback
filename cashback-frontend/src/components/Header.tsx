import React from "react";
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
      <h1>Cashback+</h1>

      <nav style={{ display: "flex", alignItems: "center" }}>
        {user ? (
          <>
            <span>Welcome, {user.name}!</span>
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
            <a href="/login" style={navLinkStyle}>
              Login
            </a>
            <a href="/register" style={navLinkStyle}>
              Register
            </a>
          </>
        )}
      </nav>
    </header>
  );
}
