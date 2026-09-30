import React, { useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Bonuses() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Редирект делаем через useEffect
  useEffect(() => {
    if (!user) {
      navigate("/register");
    }
  }, [user, navigate]);

  // Если пользователь не авторизован — временно показываем пустой экран
  if (!user) {
    return <div style={{ padding: "40px" }}>Перенаправление...</div>;
  }

  return (
    <div style={{ padding: "40px" }}>
      <h1 style={{ fontSize: "32px", marginBottom: "20px" }}>
        Получение бонусов
      </h1>

      <p style={{ fontSize: "18px", marginBottom: "30px" }}>
        Выберите способ получения бонусов:
      </p>

      <div style={{ display: "flex", gap: "20px" }}>
        <button
          onClick={() => navigate("/bonuses/ads")}
          style={{
            padding: "14px 24px",
            background: "#0078ff",
            color: "white",
            borderRadius: "12px",
            border: "none",
            cursor: "pointer",
            fontSize: "16px",
          }}
        >
          Смотреть рекламу
        </button>

        <button
          onClick={() => navigate("/bonuses/research")}
          style={{
            padding: "14px 24px",
            background: "#ff3b3b",
            color: "white",
            borderRadius: "12px",
            border: "none",
            cursor: "pointer",
            fontSize: "16px",
          }}
        >
          Участвовать в исследованиях
        </button>
      </div>
    </div>
  );
}
