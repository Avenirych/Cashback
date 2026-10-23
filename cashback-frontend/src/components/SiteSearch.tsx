import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useLang } from "../context/LanguageContext";
import "./SiteSearch.css";

type SearchPage = { path: string; title: string; titleEn: string; text: string };

export const fallbackPages: SearchPage[] = [
  {path:"/activity-limits",title:"Правила активности",titleEn:"Activity rules",text:"limits UTC FREE PREMIUM лимиты ограничения"},
  { path: "/cookies", title: "Политика Cookies", titleEn: "Cookie Policy", text: "cookies файлы cookie" },
  { path: "/", title: "Главная", titleEn: "Home", text: "cashback welcome главная старт" },
  { path: "/about", title: "О нас", titleEn: "About us", text: "компания проект about" },
  { path: "/services", title: "Как это работает", titleEn: "How it works", text: "помощь инструкция cashback services" },
  { path: "/shop", title: "Магазин", titleEn: "Shop", text: "товары покупки скидки products shopping" },
  { path: "/forum", title: "Форум", titleEn: "Forum", text: "темы обсуждения topics" },
  { path: "/bonuses", title: "Бонусы", titleEn: "Bonuses", text: "награды rewards" },
  { path: "/bonuses/ads", title: "Бонусы за рекламу", titleEn: "Advertising bonuses", text: "реклама ads" },
  { path: "/bonuses/research", title: "Исследования", titleEn: "Research", text: "опросы survey" },
  { path: "/faq", title: "Частые вопросы", titleEn: "FAQ", text: "вопросы ответы помощь help" },
  { path: "/contacts", title: "Контакты", titleEn: "Contacts", text: "связь поддержка email support" },
  { path: "/terms", title: "Условия использования", titleEn: "Terms and conditions", text: "правила соглашение terms" },
  { path: "/privacy", title: "Конфиденциальность", titleEn: "Privacy policy", text: "личные данные privacy" },
  { path: "/product-offers", title: "Предложения", titleEn: "Product offers", text: "товары предложения offers" },
  { path: "/forum/rules", title: "Правила форума", titleEn: "Forum rules", text: "форум правила" },
];

// Keep the existing DE/FR labels and keywords independently of generated titles.
const localizedPages: Record<string, { de: string; fr: string; keywords: string }> = {
 "/activity-limits":{de:"Aktivitätsregeln",fr:"Règles d’activité",keywords:"limits UTC quotas"},
  "/": { de: "Startseite", fr: "Accueil", keywords: "cashback главная welcome home" },
  "/about": { de: "Über uns", fr: "À propos", keywords: "компания проект about company" },
  "/services": { de: "So funktioniert's", fr: "Comment ça marche", keywords: "инструкция помощь cashback how works" },
  "/shop": { de: "Shop", fr: "Boutique", keywords: "товары покупки цены скидки shop products discount" },
  "/forum": { de: "Forum", fr: "Forum", keywords: "обсуждение темы вопросы forum topics" },
  "/bonuses": { de: "Boni", fr: "Bonus", keywords: "баллы cashback бонусы rewards" },
  "/bonuses/ads": { de: "Werbeboni", fr: "Bonus publicitaires", keywords: "реклама объявления ads advertising" },
  "/bonuses/research": { de: "Forschung", fr: "Recherche", keywords: "опросы исследования survey research" },
  "/faq": { de: "FAQ", fr: "FAQ", keywords: "faq помощь вопросы ответы help" },
  "/contacts": { de: "Kontakt", fr: "Contacts", keywords: "почта связь email support contact" },
  "/terms": { de: "Nutzungsbedingungen", fr: "Conditions d'utilisation", keywords: "правила соглашение terms" },
  "/privacy": { de: "Datenschutz", fr: "Confidentialité", keywords: "данные приватность privacy" },
};

// Only these known static React routes may come from the JSON index.
const allowedPaths = new Set(fallbackPages.map((page) => page.path));
function isAllowedPath(path: unknown): path is string {
  return typeof path === "string" && allowedPaths.has(path);
}
function getPageTitle(page: SearchPage, language: string): string {
  if (language === "ru") return page.title;
  const localized = localizedPages[page.path];
  if (language === "de") return localized?.de || page.titleEn;
  if (language === "fr") return localized?.fr || page.titleEn;
  return page.titleEn;
}

const ui: Record<string, { placeholder: string; empty: string; search: string }> = {
  ru: { placeholder: "Поиск по сайту", empty: "Ничего не найдено", search: "Найти" },
  en: { placeholder: "Search the site", empty: "No results found", search: "Search" },
  de: { placeholder: "Website durchsuchen...", empty: "Keine Ergebnisse", search: "Suche" },
  fr: { placeholder: "Rechercher sur le site...", empty: "Aucun résultat", search: "Rechercher" },
};

export default function SiteSearch({ resultsPage = false }: { resultsPage?: boolean }) {
  const { lang } = useLang();
  const language = (lang || "en").toLowerCase();
  const t = ui[language] || ui.en;
  const navigate = useNavigate();
  const root = useRef<HTMLDivElement>(null);
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") || "");
  useEffect(() => { setQuery(params.get("q") || ""); }, [params]);
  const [open, setOpen] = useState(false);
  const [pages, setPages] = useState<SearchPage[]>(fallbackPages);

  useEffect(() => {
    const controller = new AbortController();
    const base = (process.env.PUBLIC_URL || "").replace(/\/$/, "");
    fetch(`${base}/search-index.json`, { signal: controller.signal, cache: "no-cache" })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((data: unknown) => {
        if (!Array.isArray(data)) throw new Error("Invalid search index format");
        const indexed = data.filter((item): item is SearchPage =>
          item !== null && typeof item === "object" &&
          isAllowedPath(item.path) && typeof item.title === "string" &&
          typeof item.titleEn === "string" && typeof item.text === "string"
        );
        if (controller.signal.aborted || indexed.length === 0) return;
        const merged = new Map<string, SearchPage>(fallbackPages.map((page) => [page.path, page]));
        for (const page of indexed) {
          const previous = merged.get(page.path);
          merged.set(page.path, { ...page, text: `${previous?.text || ""} ${page.text}` });
        }
        setPages(Array.from(merged.values()));
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) console.warn("Search index unavailable; using section search.", error);
      });
    return () => controller.abort();
  }, []);

  const results = useMemo(() => {
    const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    return pages.map((page) => {
      const localized = localizedPages[page.path];
      const titles = `${page.title} ${page.titleEn} ${localized?.de || ""} ${localized?.fr || ""}`.toLocaleLowerCase();
      const content = `${titles} ${page.path} ${page.text} ${localized?.keywords || ""}`.toLocaleLowerCase();
      if (!terms.every((term) => content.includes(term))) return { page, score: -1 };
      return { page, score: terms.reduce((sum, term) => sum + (titles.includes(term) ? 10 : 1), 0) };
    }).filter((item) => item.score >= 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8).map((item) => item.page);
  }, [pages, query]);

  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, []);

  return (
    <div className={resultsPage ? "site-search site-search-page" : "site-search"} ref={root} role="search">
      {resultsPage && <h1>{language === "ru" ? "Результаты поиска" : "Search results"}</h1>}
      <form className="site-search-form" onSubmit={(event) => {
        event.preventDefault();
        if (query.trim()) navigate(`/search?q=${encodeURIComponent(query.trim())}`);
        setOpen(true);
      }}>
        <input aria-label={t.search} type="search" autoComplete="off" value={query}
          placeholder={t.placeholder} onFocus={() => setOpen(true)}
          onChange={(event) => { setQuery(event.target.value); setOpen(true); }} />
        <button type="submit" aria-label={t.search} title={t.search}>
          <span>{t.search}</span><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" />
          </svg>
        </button>
      </form>
      {(open || resultsPage) && query.trim() && (
        <div className={resultsPage ? "site-search-results search-page-results" : "site-search-results"} aria-label={t.search}>
          {results.length ? results.map((page) => (
            <Link key={page.path} to={page.path} onClick={() => setOpen(false)}>
              <span>{getPageTitle(page, language)}</span>
              <small>{page.text.slice(Math.max(0, page.text.toLocaleLowerCase().indexOf(query.trim().toLocaleLowerCase()) - 50), Math.max(0, page.text.toLocaleLowerCase().indexOf(query.trim().toLocaleLowerCase()) - 50) + 200)}</small>
            </Link>
          )) : <div className="site-search-empty">{t.empty}</div>}
        </div>
      )}
    </div>
  );
}
