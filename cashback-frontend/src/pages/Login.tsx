import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import ForumLogo from "../components/ForumLogo";
import { translations } from "../i18n";

export default function Login({ lang, onLangChange }: { lang: string; onLangChange: (lang: string) => void }) {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const t = translations[lang as keyof typeof translations] ?? translations.EN;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(form);
      navigate("/forum", { replace: true });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t.loginRegister;
      setError(errorMessage);
      console.error("Login error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(to bottom, #f5e8d3, #e3d2b8)" }}>
      <div style={{ maxWidth: "480px", margin: "0 auto", padding: "40px 24px" }}>
        <Link to="/" style={{ color: "#0d6efd", textDecoration: "none", marginBottom: "24px", display: "inline-block", fontSize: "14px" }}>
          {t.backToHome}
        </Link>

        <div style={{ backgroundColor: "white", padding: "32px", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
          <Link to="/" style={{ display: "inline-block", marginBottom: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }}>
              <ForumLogo size={32} />
              <h1 style={{ margin: 0, fontSize: "24px", color: "#000" }}>{t.login}</h1>
            </div>
          </Link>

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

          <form onSubmit={submit} style={{ display: "grid", gap: "12px" }}>
            <input
              id="email"
              name="email"
              type="email"
              placeholder={t.email}
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
              placeholder={t.password}
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
              {loading ? t.creating : t.login}
            </button>
          </form>

          <p style={{ marginTop: "24px", textAlign: "center", color: "#666" }}>
            {t.noAccount}{" "}
            <Link to="/register" style={{ color: "#0d6efd", textDecoration: "none" }}>
              {t.register}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
