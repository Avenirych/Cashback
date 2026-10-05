import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(form);
      navigate("/", { replace: true });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Невозможно войти";
      setError(errorMessage);
      console.error("Login error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "40px", maxWidth: "480px", margin: "0 auto" }}>
      <Link to="/" style={{ color: "#0d6efd", textDecoration: "none", marginBottom: "24px", display: "inline-block" }}>
        ← Вернуться на главную
      </Link>

      <h1>Вход</h1>

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
          id="email"
          name="email"
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
          autoComplete="email"
          disabled={loading}
          style={{ padding: "12px", borderRadius: "6px", border: "1px solid #ddd" }}
        />

        <input
          id="password"
          name="password"
          type="password"
          placeholder="Пароль"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
          autoComplete="current-password"
          disabled={loading}
          style={{ padding: "12px", borderRadius: "6px", border: "1px solid #ddd" }}
        />

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "12px",
            backgroundColor: "#0d6efd",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: loading ? "not-allowed" : "pointer",
            fontSize: "16px",
            fontWeight: 500,
          }}
        >
          {loading ? "Загрузка..." : "Войти"}
        </button>
      </form>

      <p style={{ marginTop: "24px", textAlign: "center", color: "#666" }}>
        Нет аккаунта?{" "}
        <Link to="/register" style={{ color: "#0d6efd", textDecoration: "none" }}>
          Зарегистрироваться
        </Link>
      </p>
    </div>
  );
}
