import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: "", password: "" });

  const submit = (e) => {
    e.preventDefault();
    login(form);
    navigate("/welcome");
  };

  return (
    <div style={{ padding: "40px", maxWidth: "480px", margin: "0 auto" }}>
      <h1>Вход</h1>

      <form onSubmit={submit} style={{ marginTop: "20px" }}>
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
