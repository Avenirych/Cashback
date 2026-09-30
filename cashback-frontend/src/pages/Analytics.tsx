import { useEffect, useMemo, useState } from "react";

type EventType = "necessary" | "analytics" | "functional" | "marketing";

interface AnalyticsEvent {
  id: string;
  type: EventType;
  store: string;
  timestamp: string; // ISO
  title: string;
}

interface CookieSettings {
  necessary: boolean;
  analytics: boolean;
  functional: boolean;
  marketing: boolean;
}

export default function Analytics() {
  const [cookieSettings, setCookieSettings] = useState<CookieSettings>({
    necessary: true,
    analytics: false,
    functional: false,
    marketing: false,
  });

  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [storeFilter, setStoreFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<EventType | "all">("all");

  useEffect(() => {
    const saved = localStorage.getItem("cashback_cookie_settings");
    if (saved) {
      setCookieSettings(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (dateFrom) params.append("from", dateFrom);
        if (dateTo) params.append("to", dateTo);
        if (storeFilter) params.append("store", storeFilter);
        if (typeFilter !== "all") params.append("type", typeFilter);

        const res = await fetch(
          `http://localhost:3000/analytics/events?${params.toString()}`
        );
        if (!res.ok) {
          throw new Error(`Ошибка загрузки: ${res.status}`);
        }
        const data = await res.json();
        setEvents(data);
      } catch (e: any) {
        setError(e.message || "Не удалось загрузить события");
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [dateFrom, dateTo, storeFilter, typeFilter]);

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      if (event.type === "necessary") return true;
      if (event.type === "analytics" && cookieSettings.analytics) return true;
      if (event.type === "functional" && cookieSettings.functional) return true;
      if (event.type === "marketing" && cookieSettings.marketing) return true;
      return false;
    });
  }, [events, cookieSettings]);

  const countsByType = useMemo(() => {
    const base = {
      necessary: 0,
      analytics: 0,
      functional: 0,
      marketing: 0,
    };
    filteredEvents.forEach((e) => {
      base[e.type] += 1;
    });
    return base;
  }, [filteredEvents]);

  const exportCSV = () => {
    if (filteredEvents.length === 0) return;

    const header = "id,type,store,timestamp,title\n";
    const rows = filteredEvents
      .map(
        (e) =>
          `${e.id},${e.type},${e.store},${e.timestamp},"${e.title.replace(
            /"/g,
            '""'
          )}"`
      )
      .join("\n");

    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cashback-analytics.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const maxCount = Math.max(
    countsByType.necessary,
    countsByType.analytics,
    countsByType.functional,
    countsByType.marketing,
    1
  );

  const barHeight = (count: number) =>
    maxCount === 0 ? 0 : (count / maxCount) * 100;

  return (
    <div style={{ padding: "30px" }}>
      <h1 style={{ marginBottom: "20px" }}>Аналитика Cashback+</h1>

      <div
        style={{
          padding: "14px 16px",
          background: "rgba(0,120,255,0.06)",
          borderRadius: "10px",
          marginBottom: "20px",
          fontSize: "14px",
        }}
      >
        <strong>Настройки Cookies:</strong>
        <ul style={{ marginTop: "10px", lineHeight: 1.6 }}>
          <li>Строго необходимые: всегда включены</li>
          <li>
            Аналитические:{" "}
            {cookieSettings.analytics ? "включены (события видны)" : "выключены (события скрыты)"}
          </li>
          <li>
            Функциональные:{" "}
            {cookieSettings.functional ? "включены" : "выключены"}
          </li>
          <li>
            Маркетинговые:{" "}
            {cookieSettings.marketing ? "включены" : "выключены"}
          </li>
        </ul>
      </div>

      <div
        style={{
          display: "flex",
          gap: "16px",
          flexWrap: "wrap",
          marginBottom: "20px",
          fontSize: "14px",
        }}
      >
        <div>
          <div>Дата с:</div>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div>
          <div>Дата по:</div>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
        <div>
          <div>Магазин:</div>
          <input
            type="text"
            placeholder="например, Amazon"
            value={storeFilter}
            onChange={(e) => setStoreFilter(e.target.value)}
          />
        </div>
        <div>
          <div>Тип события:</div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
          >
            <option value="all">Все</option>
            <option value="necessary">Строго необходимые</option>
            <option value="analytics">Аналитические</option>
            <option value="functional">Функциональные</option>
            <option value="marketing">Маркетинговые</option>
          </select>
        </div>
        <div style={{ alignSelf: "flex-end" }}>
          <button
            onClick={exportCSV}
            style={{
              padding: "8px 12px",
              borderRadius: "8px",
              border: "1px solid #ccc",
              background: "#ffffff",
              cursor: "pointer",
              fontSize: "13px",
            }}
          >
            Экспорт в CSV
          </button>
        </div>
      </div>

      <h2 style={{ marginBottom: "10px" }}>График событий по типам</h2>

      <div
        style={{
          display: "flex",
          gap: "16px",
          alignItems: "flex-end",
          height: "160px",
          marginBottom: "24px",
        }}
      >
        {(["necessary", "analytics", "functional", "marketing"] as EventType[]).map(
          (type) => {
            const count = countsByType[type];
            const enabled =
              type === "necessary"
                ? true
                : type === "analytics"
                ? cookieSettings.analytics
                : type === "functional"
                ? cookieSettings.functional
                : cookieSettings.marketing;

            return (
              <div
                key={type}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  fontSize: "13px",
                }}
              >
                <div
                  style={{
                    width: "40px",
                    height: `${barHeight(count)}%`,
                    background: enabled ? "#0078ff" : "#ccc",
                    borderRadius: "8px 8px 0 0",
                    position: "relative",
                    transition: "height 0.3s ease, background 0.3s ease",
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      top: "-18px",
                      left: "50%",
                      transform: "translateX(-50%)",
                      fontSize: "12px",
                    }}
                  >
                    {count}
                  </span>
                </div>
                <div style={{ marginTop: "6px" }}>
                  {type === "necessary"
                    ? "Necessary"
                    : type === "analytics"
                    ? "Analytics"
                    : type === "functional"
                    ? "Functional"
                    : "Marketing"}
                </div>
                <div
                  style={{
                    fontSize: "11px",
                    color: enabled ? "#0078ff" : "#999",
                  }}
                >
                  {enabled ? "включено" : "выключено"}
                </div>
              </div>
            );
          }
        )}
      </div>

      <h2 style={{ marginBottom: "10px" }}>События</h2>

      {loading && <p>Загрузка событий...</p>}
      {error && (
        <p style={{ color: "red", fontSize: "13px" }}>Ошибка: {error}</p>
      )}

      {!loading && filteredEvents.length === 0 && (
        <p style={{ fontSize: "14px", color: "#777" }}>
          Нет событий для отображения. Возможно, некоторые категории Cookies
          отключены или фильтры слишком строгие.
        </p>
      )}

      {!loading && filteredEvents.length > 0 && (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "13px",
          }}
        >
          <thead>
            <tr>
              <th style={{ borderBottom: "1px solid #ddd", padding: "8px" }}>
                Время
              </th>
              <th style={{ borderBottom: "1px solid #ddd", padding: "8px" }}>
                Магазин
              </th>
              <th style={{ borderBottom: "1px solid #ddd", padding: "8px" }}>
                Тип
              </th>
              <th style={{ borderBottom: "1px solid #ddd", padding: "8px" }}>
                Описание
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredEvents.map((e) => (
              <tr key={e.id}>
                <td
                  style={{
                    borderBottom: "1px solid #eee",
                    padding: "6px 8px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {new Date(e.timestamp).toLocaleString()}
                </td>
                <td
                  style={{
                    borderBottom: "1px solid #eee",
                    padding: "6px 8px",
                  }}
                >
                  {e.store}
                </td>
                <td
                  style={{
                    borderBottom: "1px solid #eee",
                    padding: "6px 8px",
                  }}
                >
                  {e.type}
                </td>
                <td
                  style={{
                    borderBottom: "1px solid #eee",
                    padding: "6px 8px",
                  }}
                >
                  {e.title}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
