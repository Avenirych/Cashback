import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(form);
      navigate("/");
    } catch (err) {
      setError("Неверный email или пароль");
    }
  };

  return (
    <div style={{ padding: "40px", maxWidth: "480px", margin: "0 auto" }}>
      <h1>Вход</h1>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <form onSubmit={submit} style={{ marginTop: "20px", display: "grid", gap: "12px" }}>
        <input
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
        />

        <input
          type="password"
          placeholder="Пароль"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
        />

        <button type="submit">Войти</button>
      </form>
    </div>
  );
}
