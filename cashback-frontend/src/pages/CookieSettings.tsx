import { useEffect, useState } from "react";

const STORAGE_KEY = "cashback_cookie_settings";

export default function CookieSettings() {
  const [settings, setSettings] = useState({
    necessary: true,
    analytics: false,
    functional: false,
    marketing: false,
  });

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setSettings(JSON.parse(saved));
    }
  }, []);

  const update = (key: string, value: boolean) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
  };

  return (
    <div style={{ padding: "30px", maxWidth: "800px", margin: "0 auto" }}>
      <h1 style={{ marginBottom: "20px" }}>Настройки Cookies</h1>

      <p style={{ fontSize: "15px", lineHeight: 1.6, marginBottom: "20px" }}>
        Здесь вы можете выбрать, какие категории Cookies разрешены для использования
        в сервисе Cashback+. Ваши настройки будут сохранены и учтены в аналитике.
      </p>

      <div style={{ marginBottom: "25px" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <input
            type="checkbox"
            checked={settings.necessary}
            disabled
          />
          <strong>Строго необходимые Cookies</strong> — обязательны для работы сервиса.
        </label>
      </div>

      <div style={{ marginBottom: "25px" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <input
            type="checkbox"
            checked={settings.analytics}
            onChange={(e) => update("analytics", e.target.checked)}
          />
          <strong>Аналитические Cookies</strong> — помогают улучшать сервис.
        </label>
      </div>

      <div style={{ marginBottom: "25px" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <input
            type="checkbox"
            checked={settings.functional}
            onChange={(e) => update("functional", e.target.checked)}
          />
          <strong>Функциональные Cookies</strong> — сохраняют ваши настройки.
        </label>
      </div>

      <div style={{ marginBottom: "25px" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <input
            type="checkbox"
            checked={settings.marketing}
            onChange={(e) => update("marketing", e.target.checked)}
          />
          <strong>Маркетинговые Cookies</strong> — персонализированные предложения.
        </label>
      </div>

      <div
        style={{
          marginTop: "30px",
          padding: "12px 16px",
          background: "rgba(0,120,255,0.08)",
          borderRadius: "10px",
          fontSize: "14px",
        }}
      >
        ⚙️ Ваши настройки автоматически сохраняются и учитываются в аналитике Cashback+.
      </div>
    </div>
  );
}
