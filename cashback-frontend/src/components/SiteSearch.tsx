import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLang } from "../context/LanguageContext";
import "./SiteSearch.css";

type Page = { path: string; names: Record<string, string>; keywords: string };
const pages: Page[] = [
  { path: "/", names: { ru: "Главная", en: "Home", de: "Startseite", fr: "Accueil" }, keywords: "cashback главная welcome home" },
  { path: "/about", names: { ru: "О нас", en: "About us", de: "Über uns", fr: "À propos" }, keywords: "компания проект about company" },
  { path: "/services", names: { ru: "Как это работает", en: "How it works", de: "So funktioniert's", fr: "Comment ça marche" }, keywords: "инструкция помощь cashback how works" },
  { path: "/shop", names: { ru: "Магазин", en: "Shop", de: "Shop", fr: "Boutique" }, keywords: "товары покупки цены скидки shop products discount" },
  { path: "/forum", names: { ru: "Форум", en: "Forum", de: "Forum", fr: "Forum" }, keywords: "обсуждение темы вопросы forum topics" },
  { path: "/bonuses", names: { ru: "Бонусы", en: "Bonuses", de: "Boni", fr: "Bonus" }, keywords: "баллы cashback бонусы rewards" },
  { path: "/bonuses/ads", names: { ru: "Бонусы за рекламу", en: "Ad bonuses", de: "Werbeboni", fr: "Bonus publicitaires" }, keywords: "реклама объявления ads advertising" },
  { path: "/bonuses/research", names: { ru: "Исследования", en: "Research", de: "Forschung", fr: "Recherche" }, keywords: "опросы исследования survey research" },
  { path: "/faq", names: { ru: "Частые вопросы", en: "FAQ", de: "FAQ", fr: "FAQ" }, keywords: "faq помощь вопросы ответы help" },
  { path: "/contacts", names: { ru: "Контакты", en: "Contacts", de: "Kontakt", fr: "Contacts" }, keywords: "почта связь email support contact" },
  { path: "/terms", names: { ru: "Условия использования", en: "Terms and conditions", de: "Nutzungsbedingungen", fr: "Conditions d'utilisation" }, keywords: "правила соглашение terms" },
  { path: "/privacy", names: { ru: "Политика конфиденциальности", en: "Privacy policy", de: "Datenschutz", fr: "Confidentialité" }, keywords: "данные приватность privacy" },
];
const ui: Record<string, { placeholder: string; noResults: string; search: string }> = {
  ru: { placeholder: "Поиск по сайту...", noResults: "Разделы не найдены", search: "Поиск" },
  en: { placeholder: "Search the site...", noResults: "No pages found", search: "Search" },
  de: { placeholder: "Website durchsuchen...", noResults: "Keine Seiten gefunden", search: "Suche" },
  fr: { placeholder: "Rechercher sur le site...", noResults: "Aucune page trouvée", search: "Rechercher" },
};
export default function SiteSearch() {
  const { lang } = useLang();
  const language = (lang || "en").toLowerCase();
  const t = ui[language] || ui.en;
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const results = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    if (!q) return [];
    return pages.filter(page =>
      Object.values(page.names).some(name => name.toLocaleLowerCase().includes(q)) ||
      page.keywords.toLocaleLowerCase().includes(q)
    ).slice(0, 8);
  }, [query]);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, []);
  const go = (path: string) => { navigate(path); setOpen(false); setQuery(""); };
  return (
    <div className="site-search" ref={root} role="search">
      <form className="site-search-form" onSubmit={event => { event.preventDefault(); if (results.length) go(results[0].path); else setOpen(true); }}>
        <input aria-label={t.search} type="search" autoComplete="off" value={query} placeholder={t.placeholder}
          onFocus={() => setOpen(true)} onChange={event => { setQuery(event.target.value); setOpen(true); }} />
        <button type="submit" aria-label={t.search} title={t.search}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></svg>
        </button>
      </form>
      {open && query.trim() && (
        <div className="site-search-results" role="listbox" aria-label={t.search}>
          {results.length ? results.map(page => (
            <button key={page.path} type="button" role="option" aria-selected="false" onClick={() => go(page.path)}>
              <span>{page.names[language] || page.names.en}</span><small>{page.path}</small>
            </button>
          )) : <div className="site-search-empty">{t.noResults}</div>}
        </div>
      )}
    </div>
  );
}
