import { useEffect, useState } from "react";

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

  const exportSettings = () => {
    const dataStr =
      "data:application/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(settings, null, 2));
    const a = document.createElement("a");
    a.href = dataStr;
    a.download = "cashback-cookie-settings.json";
    a.click();
  };

  const Toggle = ({
    label,
    description,
    value,
    disabled,
    onChange,
  }: {
    label: string;
    description: string;
    value: boolean;
    disabled?: boolean;
    onChange?: () => void;
  }) => (
    <div style={{ marginBottom: "18px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <div
          className={
            "cookie-toggle" + (value ? " on" : "") + (disabled ? " disabled" : "")
          }
          onClick={() => {
            if (!disabled && onChange) onChange();
          }}
        >
          <div className="cookie-toggle-knob" />
        </div>

        <div>
          <div
            style={{
              fontSize: "14px",
              fontWeight: 600,
              marginBottom: "2px",
            }}
          >
            {label}
          </div>
          <div
            style={{
              fontSize: "13px",
              color: "#555",
            }}
          >
            {description}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="cookie-modal-backdrop">
      <div className="cookie-modal">
        <h2
          style={{
            margin: "0 0 12px 0",
            fontSize: "18px",
          }}
        >
          Cookie Settings
        </h2>

        <p
          style={{
            fontSize: "14px",
            lineHeight: 1.6,
            marginBottom: "16px",
          }}
        >
          You can choose which categories of cookies are allowed. Your preferences
          are saved in your browser and used to improve Cashback+ analytics.
        </p>

        <Toggle
          label="Strictly necessary"
          description="Ensure the service works correctly and cashback is tracked."
          value={settings.necessary}
          disabled
        />

        <Toggle
          label="Analytics"
          description="Help improve the service and interface."
          value={settings.analytics}
          onChange={() => update("analytics", !settings.analytics)}
        />

        <Toggle
          label="Functional"
          description="Save your interface preferences and settings."
          value={settings.functional}
          onChange={() => update("functional", !settings.functional)}
        />

        <Toggle
          label="Marketing"
          description="Used for personalized offers and promotions."
          value={settings.marketing}
          onChange={() => update("marketing", !settings.marketing)}
        />

        <div
          style={{
            marginTop: "16px",
            padding: "10px 12px",
            borderRadius: "10px",
            background: "rgba(0,120,255,0.06)",
            fontSize: "13px",
          }}
        >
          GDPR: You can change your consent at any time. Cookie settings are not
          used to sell your personal data to third parties.
        </div>

        <div
          style={{
            marginTop: "18px",
            display: "flex",
            justifyContent: "space-between",
            gap: "10px",
          }}
        >
          <button
            onClick={exportSettings}
            style={{
              padding: "8px 12px",
              borderRadius: "8px",
              border: "1px solid #ccc",
              background: "#ffffff",
              cursor: "pointer",
              fontSize: "13px",
            }}
          >
            Export settings (JSON)
          </button>

          <button
            onClick={onClose}
            style={{
              padding: "8px 12px",
              borderRadius: "8px",
              border: "1px solid #ccc",
              background: "#f5f5f5",
              cursor: "pointer",
              fontSize: "13px",
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
