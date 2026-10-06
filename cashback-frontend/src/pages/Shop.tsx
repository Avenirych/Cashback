import React from "react";
import { useNavigate, Link } from "react-router-dom";
import { translations } from "../i18n";

interface ShopProps {
  lang: string;
}

export default function Shop({ lang }: ShopProps) {
  const navigate = useNavigate();
  const t = (translations as any)[lang?.toUpperCase()] ?? translations.EN;

  return (
    <div style={{ minHeight: "calc(100vh - 72px)", background: "linear-gradient(to bottom, #f5e8d3, #e3d2b8)" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "40px 24px" }}>
        <Link to="/" style={{ color: "#0d6efd", textDecoration: "none", marginBottom: "24px", display: "inline-block", fontSize: "14px" }}>
          ← {t.backToHome}
        </Link>

        <div style={{ backgroundColor: "white", padding: "40px", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
          <h1 style={{ fontSize: "32px", fontWeight: 700, marginBottom: "30px", color: "#000" }}>
            {t.shopTitle ?? "Shop"}
          </h1>

          <div style={{ minHeight: "300px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <p style={{ fontSize: "18px", color: "#666", textAlign: "center" }}>
              {t.noProducts ?? "No products available"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
