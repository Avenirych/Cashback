import React from "react";
import { useLang } from "../context/LangContext";

export default function LanguageSwitcher() {
  const { lang, changeLang } = useLang();

  return (
    <select
      value={lang}
      onChange={(e) => changeLang(e.target.value)}
      style={{
        padding: "6px 10px",
        borderRadius: "8px",
        border: "1px solid var(--sidebar-border)",
        background: "var(--sidebar-bg)",
        cursor: "pointer",
      }}
    >
      <option value="EN">EN</option>
      <option value="RU">RU</option>
      <option value="DE">DE</option>
      <option value="FR">FR</option>
      <option value="ES">ES</option>
      <option value="CN">CN</option>
    </select>
  );
}
