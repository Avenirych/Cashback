import React, { createContext, useContext, useState } from "react";

interface LangContextType {
  lang: string;
  setLang: (lang: string) => void;
}

const LangContext = createContext<LangContextType>({
  lang: "en",
  setLang: () => {},
});

export const LangProvider = ({ children }: { children: React.ReactNode }) => {
  const [lang, setLangState] = useState<string>(() => localStorage.getItem("lang") || "en");

  const setLang = (newLang: string) => {
    setLangState(newLang);
    localStorage.setItem("lang", newLang);
  };

  return (
    <LangContext.Provider value={{ lang, setLang }}>
      {children}
    </LangContext.Provider>
  );
};

export const useLang = () => useContext(LangContext);
