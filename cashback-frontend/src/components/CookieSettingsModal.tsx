import { useEffect, useState } from "react";
import "./CookieConsent.css";
import {useLang} from '../context/LanguageContext';
import {cookieMessages} from '../content/cookieMessages';

const STORAGE_KEY_SETTINGS = "cashback_cookie_settings";

interface Props {
  onClose: () => void;
}

export default function CookieSettingsModal({ onClose }: Props) {
  const {lang}=useLang(),t=cookieMessages[lang as keyof typeof cookieMessages];
  const [settings, setSettings] = useState({
    necessary: true,
    analytics: false,
    functional: false,
    marketing: false,
  });

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (saved) {
      try { const value=JSON.parse(saved); if(value && typeof value==='object') setSettings({necessary:true,analytics:value.analytics===true,functional:value.functional===true,marketing:value.marketing===true}); } catch { /* Invalid local storage must not break policy access. */ }
    }
  }, []);

  const update = (key: keyof typeof settings, value: boolean) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(newSettings));
  };

  if(!t)return null;
  return (
    <div className="cookie-modal-backdrop">
      <div className="cookie-modal" lang={lang} role="dialog" aria-modal="true" aria-label={t.settings}>
        <h2>{t.settings}</h2>

        <p className="cookie-modal-text">
          {t.settingsDescription}
        </p>

        <div className="cookie-setting">
          <label>
            <input type="checkbox" checked={settings.necessary} disabled />
            {t.necessary}
          </label>
        </div>

        <div className="cookie-setting">
          <label>
            <input
              type="checkbox"
              checked={settings.analytics}
              onChange={(e) => update("analytics", e.target.checked)}
            />
            {t.analytics}
          </label>
        </div>

        <div className="cookie-setting">
          <label>
            <input
              type="checkbox"
              checked={settings.functional}
              onChange={(e) => update("functional", e.target.checked)}
            />
            {t.functional}
          </label>
        </div>

        <div className="cookie-setting">
          <label>
            <input
              type="checkbox"
              checked={settings.marketing}
              onChange={(e) => update("marketing", e.target.checked)}
            />
            {t.marketing}
          </label>
        </div>

        <button className="cookie-modal-close" onClick={onClose}>
          {t.close}
        </button>
      </div>
    </div>
  );
}
