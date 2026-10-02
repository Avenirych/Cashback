import { useEffect, useState } from "react";
import "./CookieConsent.css";

const STORAGE_KEY_SETTINGS = "cashback_cookie_settings";

interface Props {
  onClose: () => void;
}

export default function CookieSettingsModal({ onClose }: Props) {
  const [settings, setSettings] = useState({
    necessary: true,
    analytics: false,
    functional: false,
    marketing: false,
  });

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (saved) {
      setSettings(JSON.parse(saved));
    }
  }, []);

  const update = (key: keyof typeof settings, value: boolean) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(newSettings));
  };

  return (
    <div className="cookie-modal-backdrop">
      <div className="cookie-modal">
        <h2>Cookie Settings</h2>

        <p className="cookie-modal-text">
          You can choose which categories of cookies are allowed. Your
          preferences are saved in your browser and used to improve Cashback+
          analytics.
        </p>

        <div className="cookie-setting">
          <label>
            <input type="checkbox" checked={settings.necessary} disabled />
            Strictly necessary — required for Cashback+ to work.
          </label>
        </div>

        <div className="cookie-setting">
          <label>
            <input
              type="checkbox"
              checked={settings.analytics}
              onChange={(e) => update("analytics", e.target.checked)}
            />
            Analytics — help improve the service.
          </label>
        </div>

        <div className="cookie-setting">
          <label>
            <input
              type="checkbox"
              checked={settings.functional}
              onChange={(e) => update("functional", e.target.checked)}
            />
            Functional — save your interface preferences.
          </label>
        </div>

        <div className="cookie-setting">
          <label>
            <input
              type="checkbox"
              checked={settings.marketing}
              onChange={(e) => update("marketing", e.target.checked)}
            />
            Marketing — personalized offers.
          </label>
        </div>

        <button className="cookie-modal-close" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
