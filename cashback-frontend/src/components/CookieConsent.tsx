import React, { useEffect, useState } from "react";

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const accepted = localStorage.getItem("cookiesAccepted");
    if (!accepted) setVisible(true);
  }, []);

  const acceptCookies = () => {
    localStorage.setItem("cookiesAccepted", "true");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "20px",
        left: "20px",
        right: "20px",
        padding: "20px",
        background: "var(--sidebar-bg)",
        border: "1px solid var(--sidebar-border)",
        borderRadius: "12px",
        boxShadow: "0 6px 20px rgba(0,0,0,0.15)",
        zIndex: 9999,
      }}
    >
      <p style={{ marginBottom: "16px", fontSize: "15px", lineHeight: 1.6 }}>
        Мы используем cookies для улучшения работы сайта.
      </p>

      <button
        onClick={acceptCookies}
        style={{
          padding: "10px 18px",
          background: "#0078ff",
          color: "white",
          border: "none",
          borderRadius: "8px",
          cursor: "pointer",
          fontWeight: 600,
        }}
      >
        Принять
      </button>
    </div>
  );
}
