import React from "react";
import { useLang } from "../context/LanguageContext";

export default function LanguageSwitcher() {
  const { lang, setLang } = useLang();

  return (
    <select
      value={lang}
      onChange={(e) => setLang(e.target.value)}
      style={{
        padding: "6px 10px",
        borderRadius: "6px",
        fontSize: "14px",
        cursor: "pointer",
        background: "rgba(255,255,255,0.4)",
        border: "1px solid rgba(0,0,0,0.15)",
      }}
    >
      <option value="en">EN</option>
      <option value="ru">RU</option>
      <option value="de">DE</option>
      <option value="fr">FR</option>
    </select>
  );
}
