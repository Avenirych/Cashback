import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await register(form);
      navigate("/");
    } catch (err) {
      setError("Не удалось зарегистрировать пользователя");
    }
  };

  return (
    <div style={{ padding: "40px", maxWidth: "480px", margin: "0 auto" }}>
      <h1>Регистрация</h1>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <form onSubmit={submit} style={{ marginTop: "20px", display: "grid", gap: "12px" }}>
        <input
          type="text"
          placeholder="Имя"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />

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

        <button type="submit">Зарегистрироваться</button>
      </form>
    </div>
  );
}
