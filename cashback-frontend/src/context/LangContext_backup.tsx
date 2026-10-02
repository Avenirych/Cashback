import React, { createContext, useContext, useState, useEffect } from "react";

interface LangContextType {
  lang: string;
  setLang: (lang: string) => void;
}

const LangContext = createContext<LangContextType>({
  lang: "en",
  setLang: () => {},
});

export const LangProvider = ({ children }: { children: React.ReactNode }) => {
  const [lang, setLang] = useState("en");

  // ✅ сохраняем язык между перезагрузками
  useEffect(() => {
    const savedLang = localStorage.getItem("lang");
    if (savedLang) setLang(savedLang);
  }, []);

  const changeLang = (newLang: string) => {
    setLang(newLang);
    localStorage.setItem("lang", newLang);
  };

  return (
    <LangContext.Provider value={{ lang, setLang: changeLang }}>
      {children}
    </LangContext.Provider>
  );
};

export const useLang = () => useContext(LangContext);
