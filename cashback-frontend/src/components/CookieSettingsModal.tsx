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
          Настройки Cookies
        </h2>

        <p
          style={{
            fontSize: "14px",
            lineHeight: 1.6,
            marginBottom: "16px",
          }}
        >
          Вы можете выбрать, какие категории Cookies разрешены. Ваши настройки
          сохраняются в браузере и учитываются в аналитике Cashback+.
        </p>

        <Toggle
          label="Строго необходимые"
          description="Обеспечивают работу сервиса и корректное начисление кэшбэка."
          value={settings.necessary}
          disabled
        />

        <Toggle
          label="Аналитические"
          description="Помогают улучшать сервис и интерфейс."
          value={settings.analytics}
          onChange={() => update("analytics", !settings.analytics)}
        />

        <Toggle
          label="Функциональные"
          description="Сохраняют ваши настройки интерфейса и предпочтения."
          value={settings.functional}
          onChange={() => update("functional", !settings.functional)}
        />

        <Toggle
          label="Маркетинговые"
          description="Используются для персонализированных предложений и акций."
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
          GDPR: вы можете изменить своё согласие в любой момент. Настройки
          Cookies не используются для продажи ваших персональных данных третьим
          лицам.
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
            Экспорт настроек (JSON)
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
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
