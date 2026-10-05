import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await register(form);
      navigate("/", { replace: true });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Не удалось зарегистрировать пользователя";
      setError(errorMessage);
      console.error("Register error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "40px", maxWidth: "480px", margin: "0 auto" }}>
      <h1>Регистрация</h1>

      {error && (
        <div
          style={{
            backgroundColor: "#fee",
            color: "#c33",
            padding: "12px",
            borderRadius: "8px",
            marginBottom: "16px",
            border: "1px solid #fcc",
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={submit} style={{ marginTop: "20px", display: "grid", gap: "12px" }}>
        <input
          id="name"
          name="name"
          type="text"
          placeholder="Имя"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
          autoComplete="name"
          disabled={loading}
        />

        <input
          id="email"
          name="email"
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
          autoComplete="email"
          disabled={loading}
        />

        <input
          id="password"
          name="password"
          type="password"
          placeholder="Пароль (мин. 3 символа)"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
          autoComplete="new-password"
          disabled={loading}
        />

        <button type="submit" disabled={loading} style={{ cursor: loading ? "not-allowed" : "pointer" }}>
          {loading ? "Загрузка..." : "Зарегистрироваться"}
        </button>
      </form>

      <p style={{ marginTop: "24px", textAlign: "center", color: "#666" }}>
        Уже есть аккаунт?{" "}
        <Link to="/login" style={{ color: "#0d6efd", textDecoration: "none" }}>
          Войти
        </Link>
      </p>
    </div>
  );
}
