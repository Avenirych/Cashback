import React, { useState, useEffect } from "react";
import "./CookieConsent.css";
import CookieSettingsModal from "./CookieSettingsModal";

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const accepted = localStorage.getItem("cookiesAccepted");
    if (!accepted) {
      setVisible(true);
    }
  }, []);

  const acceptAll = () => {
    localStorage.setItem("cookiesAccepted", "all");
    setVisible(false);
  };

  const decline = () => {
    localStorage.setItem("cookiesAccepted", "decline");
    setVisible(false);
  };

  const necessaryOnly = () => {
    localStorage.setItem("cookiesAccepted", "necessary");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="cookie-window">
      <h3>Allow Cookies for a better Cashback+ experience</h3>

      <p className="cookie-text">
        We use cookies to track your cashback, improve the service, and provide
        the best shopping experience.
      </p>

      <div className="cookie-buttons">
        <button className="cookie-btn-decline" onClick={decline}>
          Decline
        </button>

        <button className="cookie-btn-necessary" onClick={necessaryOnly}>
          Necessary only
        </button>

        <button
          className="cookie-btn-settings"
          onClick={() => setShowSettings(true)}
        >
          Manage cookies
        </button>

        <button className="cookie-btn-accept" onClick={acceptAll}>
          Accept all
        </button>
      </div>

      {/* ВАЖНО: модалка НЕ внутри баннера */}
      {showSettings && (
        <CookieSettingsModal onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}
