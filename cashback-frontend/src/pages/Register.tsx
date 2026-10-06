import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import ForumLogo from "../components/ForumLogo";
import MoneyTree from "../components/MoneyTree";
import { translations } from "../i18n";

export default function Register({ lang, onLangChange }: { lang: string; onLangChange: (lang: string) => void }) {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const t = translations[lang as keyof typeof translations] ?? translations.EN;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!termsAccepted) {
      setError(t.mustAcceptTerms || "You must accept the terms and conditions to register");
      return;
    }

    setError("");
    setLoading(true);

    try {
      await register(form);
      navigate("/", { replace: true });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t.loginRegister;
      setError(errorMessage);
      console.error("Register error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "calc(100vh - 72px)", background: "linear-gradient(to bottom, #f5e8d3, #e3d2b8)" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "40px 24px", display: "flex", justifyContent: "center", gap: "80px", alignItems: "flex-start" }}>
        {/* LEFT: Register Form */}
        <div style={{ flex: 1, maxWidth: "480px", minWidth: "300px" }}>
          <Link to="/" style={{ color: "#0d6efd", textDecoration: "none", marginBottom: "24px", display: "inline-block", fontSize: "14px" }}>
            ← {t.backToHome}
          </Link>

          <div style={{ backgroundColor: "white", padding: "32px", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
            <Link to="/" style={{ display: "inline-block", marginBottom: "24px", textDecoration: "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }}>
                <ForumLogo size={32} />
                <h1 style={{ margin: 0, fontSize: "24px", color: "#000" }}>{t.register}</h1>
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
                id="name"
                name="name"
                type="text"
                placeholder={t.name}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                autoComplete="name"
                disabled={loading}
                style={{ padding: "12px", borderRadius: "6px", border: "1px solid #ddd", fontSize: "14px" }}
              />

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
                style={{ padding: "12px", borderRadius: "6px", border: "1px solid #ddd", fontSize: "14px" }}
              />

              <input
                id="password"
                name="password"
                type="password"
                placeholder={t.minPassword}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                autoComplete="new-password"
                disabled={loading}
                style={{ padding: "12px", borderRadius: "6px", border: "1px solid #ddd", fontSize: "14px" }}
              />

              {/* Terms and Conditions Checkbox */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", marginTop: "8px" }}>
                <input
                  id="terms"
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  disabled={loading}
                  style={{ marginTop: "4px", cursor: "pointer", width: "18px", height: "18px" }}
                />
                <label htmlFor="terms" style={{ fontSize: "13px", color: "#333", cursor: "pointer", lineHeight: "1.4" }}>
                  {t.agreeTerms || "I agree to the"} {" "}
                  <Link to="/terms" target="_blank" style={{ color: "#0d6efd", textDecoration: "none" }}>
                    {t.termsAndConditions || "Terms and Conditions"}
                  </Link>
                  {" "} {t.and || "and"} {" "}
                  <Link to="/contacts" target="_blank" style={{ color: "#0d6efd", textDecoration: "none" }}>
                    {t.privacyPolicy || "Privacy Policy"}
                  </Link>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading || !termsAccepted}
                style={{
                  padding: "12px",
                  backgroundColor: termsAccepted ? "#0d6efd" : "#ccc",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: termsAccepted && !loading ? "pointer" : "not-allowed",
                  fontSize: "16px",
                  fontWeight: 500,
                  marginTop: "8px",
                  transition: "background-color 0.3s ease",
                }}
              >
                {loading ? t.creating : t.register}
              </button>
            </form>

            <p style={{ marginTop: "24px", textAlign: "center", color: "#666" }}>
              {t.haveAccount}{" "}
              <Link to="/login" style={{ color: "#0d6efd", textDecoration: "none", fontWeight: 600 }}>
                {t.login}
              </Link>
            </p>
          </div>
        </div>

        {/* RIGHT: Money Tree Animation (как "Одуванчики" на Welcome) */}
        <div style={{ flex: 1, maxWidth: "420px", minWidth: "300px" }}>
          <MoneyTree />
        </div>
      </div>
    </div>
  );
}
