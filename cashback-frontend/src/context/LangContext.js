import React, { createContext, useContext, useState, useEffect } from "react";

const LangContext = createContext(null);

export function LangProvider({ children }) {
  const [lang, setLang] = useState("EN");

  useEffect(() => {
    const saved = localStorage.getItem("lang");
    if (saved) setLang(saved.toUpperCase());
  }, []);

  const changeLang = (newLang) => {
    const normalized = newLang.toUpperCase();
    setLang(normalized);
    localStorage.setItem("lang", normalized);
  };

  return (
    <LangContext.Provider value={{ lang, changeLang }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
