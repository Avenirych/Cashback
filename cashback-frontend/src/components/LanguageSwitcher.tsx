import React from "react";
import { useLang } from "../context/LangContext";

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
      }}
    >
      <option value="en">EN</option>
      <option value="ru">RU</option>
      <option value="de">DE</option>
      <option value="fr">FR</option>
    </select>
  );
}
