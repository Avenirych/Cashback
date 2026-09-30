// src/api.ts
// Оставляем твой прежний API как есть (ничего не удаляем)

// ---------------------------------------------------------
// Мультиязычность (добавлено для работы логотипа)
// ---------------------------------------------------------

// Универсальная функция для получения JSON (нужна для страниц BrandCategorySeller, CompareProducts, ProductsList)
export async function fetchJson<T = any>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json();
}
export const translations = {
  EN: {
    // Logo
    logoAlt: "Cashback+ coin logo",
    logoTitle: "Cashback+",
    logoTooltip: "Smart shopping with Cashback+",

    // Header
    menuCatalog: "Catalog",
    menuPartners: "Partners",
    menuOffers: "Offers",
    menuTerms: "Terms",
    profile: "Profile",
    loginRegister: "Login / Register",

    // Welcome
    title: "Smart shopping with Cashback+",
    description:
      "Get cashback from stores, bonuses for watching ads and participating in research. Combine them and compensate up to 100% of your purchases.",
    goShopping: "Go shopping",
    getBonuses: "Get bonuses",
    needRegister: "You need to register to access bonuses and shopping.",
    everythingFine: "Everything will be fine",

    // Bonuses
    bonusesTitle: "Get bonuses",
    bonusesChoose: "Choose how you want to earn bonuses:",
    bonusesAds: "Watch ads",
    bonusesResearch: "Participate in research",

    // Register
    registerTitle: "Registration",
    registerName: "Your name",
    registerEmail: "Email",
    registerPassword: "Password",
    registerButton: "Register",

    // Login
    loginTitle: "Login",
    loginEmail: "Email",
    loginPassword: "Password",
    loginButton: "Login",

    // Footer
    footerPrivacy: "Privacy Policy",
    footerTerms: "Terms of Use",
  },

  RU: {
    // Logo
    logoAlt: "Логотип монеты Cashback+",
    logoTitle: "Cashback+",
    logoTooltip: "Умные покупки с Cashback+",

    // Header
    menuCatalog: "Каталог",
    menuPartners: "Партнёры",
    menuOffers: "Акции",
    menuTerms: "Условия",
    profile: "Профиль",
    loginRegister: "Вход / Регистрация",

    // Welcome
    title: "Умные покупки с Cashback+",
    description:
      "Получайте кэшбэк, бонусы за просмотр рекламы и участие в исследованиях. Комбинируйте их и компенсируйте стоимость покупок до 100%.",
    goShopping: "Перейти к покупкам",
    getBonuses: "Получить бонусы",
    needRegister: "Для доступа к бонусам и покупкам необходимо зарегистрироваться.",
    everythingFine: "Everything will be fine",

    // Bonuses
    bonusesTitle: "Получение бонусов",
    bonusesChoose: "Выберите способ получения бонусов:",
    bonusesAds: "Смотреть рекламу",
    bonusesResearch: "Участвовать в исследованиях",

    // Register
    registerTitle: "Регистрация",
    registerName: "Ваше имя",
    registerEmail: "Email",
    registerPassword: "Пароль",
    registerButton: "Зарегистрироваться",

    // Login
    loginTitle: "Вход",
    loginEmail: "Email",
    loginPassword: "Пароль",
    loginButton: "Войти",

    // Footer
    footerPrivacy: "Политика конфиденциальности",
    footerTerms: "Условия использования",
  },
};

// ---------------------------------------------------------
// Текущий язык
// ---------------------------------------------------------

export let currentLanguage: keyof typeof translations = "RU";

// ---------------------------------------------------------
// Функция получения перевода
// ---------------------------------------------------------

export function t(key: string): string {
  return translations[currentLanguage][key] || key;
}

// ---------------------------------------------------------
// Функция смены языка
// ---------------------------------------------------------

export function setLanguage(lang: keyof typeof translations) {
  currentLanguage = lang;
}
