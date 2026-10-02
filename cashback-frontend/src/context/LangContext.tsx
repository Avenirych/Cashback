import React, { createContext, useContext, useState } from "react";

interface LangContextType {
  lang: string;
  setLang: (lang: string) => void;
}

const LangContext = createContext<LangContextType>({
  lang: "en",
  setLang: () => {}, // заглушка, чтобы TS не ругался
});

export const LangProvider = ({ children }: { children: React.ReactNode }) => {
  const [lang, setLang] = useState("en");

  return (
    <LangContext.Provider value={{ lang, setLang }}>
      {children}
    </LangContext.Provider>
  );
};

export const useLang = () => useContext(LangContext);
