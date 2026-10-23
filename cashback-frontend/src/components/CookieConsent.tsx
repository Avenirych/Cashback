import React, { useState, useEffect } from "react";
import "./CookieConsent.css";
import CookieSettingsModal from "./CookieSettingsModal";
import {useLang} from '../context/LanguageContext';
import {cookieMessages} from '../content/cookieMessages';

export default function CookieConsent() {
  const {lang}=useLang(),t=cookieMessages[lang as keyof typeof cookieMessages];
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

  if (!visible||!t) return null;

  return (
    <div className="cookie-window" lang={lang} role="region" aria-label={t.title}>
      <h3>{t.title}</h3>

      <p className="cookie-text">
        {t.description}
      </p>

      <div className="cookie-buttons">
        <button className="cookie-btn-decline" onClick={decline}>
          {t.decline}
        </button>

        <button className="cookie-btn-necessary" onClick={necessaryOnly}>
          {t.necessaryOnly}
        </button>

        <button
          className="cookie-btn-settings"
          onClick={() => setShowSettings(true)}
        >
          {t.manage}
        </button>

        <button className="cookie-btn-accept" onClick={acceptAll}>
          {t.accept}
        </button>
      </div>

      {/* ВАЖНО: модалка НЕ внутри баннера */}
      {showSettings && (
        <CookieSettingsModal onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}
