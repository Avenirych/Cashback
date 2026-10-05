import React, { createContext, useContext, useState } from "react";

interface LanguageContextType {
  lang: string; // "en" | "ru" | "de" | "fr"
  setLang: (lang: string) => void;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: "en",
  setLang: () => {},
});

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
  const [lang, setLangState] = useState<string>(
    () => (localStorage.getItem("lang") || "en").toLowerCase()
  );

  const setLang = (newLang: string) => {
    const normalized = newLang.toLowerCase();
    setLangState(normalized);
    localStorage.setItem("lang", normalized);
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLang = () => useContext(LanguageContext);
