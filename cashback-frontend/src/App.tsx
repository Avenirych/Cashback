import "./App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import { AuthProvider } from "./context/AuthContext";
import { LanguageProvider, useLang } from "./context/LanguageContext";

import Header from "./components/Header";
import CookieConsent from "./components/CookieConsent";
import BonusGuard from "./components/BonusGuard";
import ProtectedGuard from "./components/ProtectedGuard";
import ForumGuard from "./components/ForumGuard";
import ForumRegister from "./pages/ForumRegister";
import ForumRules from "./pages/ForumRules";

import Welcome from "./pages/Welcome";
import AboutUs from "./pages/AboutUs";
import Services from "./pages/Services";
import Contacts from "./pages/Contacts";
import TermsAndConditions from "./pages/TermsAndConditions";
import Bonuses from "./pages/Bonuses";
import BonusAds from "./pages/BonusAds";
import BonusResearch from "./pages/BonusResearch";
import Profile from "./pages/Profile";
import TopicsPage from "./pages/TopicsPage";
import Topic from "./pages/Topic";
import Login from "./pages/Login";
import Register from "./pages/Register";
import VerifyEmail from "./pages/VerifyEmail";
import Shop from "./pages/Shop";
import PartnerNotConnected from "./pages/PartnerNotConnected";

// Временная заглушка. Замени на свой реальный компонент Dashboard, когда добавишь его файл.
function DashboardPlaceholder() {
  return (
    <main style={{ padding: "24px", maxWidth: "960px", margin: "0 auto" }}>
      <h1>Dashboard</h1>
      <p>Личный кабинет доступен только после входа и подтверждения email.</p>
    </main>
  );
}

export function AppRoutes() {
  const { lang, setLang } = useLang();
  const L = lang.toUpperCase();

  return (
    <>
      <Header />
      <CookieConsent />

      <Routes>
        <Route path="/" element={<Welcome lang={L} />} />
        <Route path="/welcome" element={<Welcome lang={L} />} />

        <Route path="/about" element={<AboutUs lang={lang} />} />
        <Route path="/services" element={<Services lang={lang} />} />
        <Route path="/contacts" element={<Contacts lang={lang} />} />
        <Route path="/terms" element={<TermsAndConditions />} />
        <Route path="/forum/rules" element={<ForumRules />} />

        <Route path="/login" element={<Login lang={L} onLangChange={setLang} />} />
        <Route path="/register" element={<Register lang={L} onLangChange={setLang} />} />
        <Route path="/verify-email" element={<VerifyEmail lang={L} />} />

        {/* Защищённые страницы: требуют авторизации и подтверждения почты */}
        <Route element={<ProtectedGuard />}>
          <Route path="/profile" element={<Profile />} />
          <Route path="/shop" element={<Shop lang={L} />} />
          <Route path="/forum/register" element={<ForumRegister />} />
          <Route path="/dashboard" element={<DashboardPlaceholder />} />
        </Route>

        {/* Форум (read-only для верифицированных, write-доступ по правилам ForumGuard) */}
        <Route element={<ForumGuard readOnly />}>
          <Route path="/forum">
            <Route index element={<TopicsPage lang={L} onLangChange={setLang} />} />
            <Route path="topics" element={<TopicsPage lang={L} onLangChange={setLang} />} />
            <Route path="topics/:id" element={<Topic lang={L} onLangChange={setLang} />} />
            <Route path="topic/:id" element={<Topic lang={L} onLangChange={setLang} />} />
          </Route>
          <Route path="/topic/:id" element={<Topic lang={L} onLangChange={setLang} />} />
        </Route>

        {/* Бонусы: дополнительная проверка onboarding */}
        <Route path="/bonuses" element={<BonusGuard />}>
          <Route index element={<Bonuses />} />
          <Route path="ads" element={<BonusAds />} />
          <Route path="research" element={<BonusResearch />} />
        </Route>

        {/* Страница неподключенного партнера */}
        <Route path="/partner-not-connected" element={<PartnerNotConnected />} />

        {/* Fallback */}
        <Route path="*" element={<Welcome lang={L} />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <LanguageProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}