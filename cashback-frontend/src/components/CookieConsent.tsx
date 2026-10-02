import React, { useState, useEffect } from "react";
import "./CookieConsent.css";

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

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
      <h3>Мы используем Cookies</h3>

      <p className="cookie-text">
        Cookies помогают улучшать работу сайта, сохранять ваши настройки,
        анализировать посещаемость и показывать персональные предложения.
      </p>

      <div className="cookie-buttons">
        <button className="cookie-btn-decline" onClick={decline}>
          Отклонить
        </button>

        <button className="cookie-btn-necessary" onClick={necessaryOnly}>
          Только необходимые
        </button>

        <button className="cookie-btn-settings">
          Настроить Cookies
        </button>

        <button className="cookie-btn-accept" onClick={acceptAll}>
          Принять всё
        </button>
      </div>
    </div>
  );
}
