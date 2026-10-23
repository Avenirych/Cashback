import "./App.css";
import ActivityRules from './pages/ActivityRules';
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ProductOffers from "./pages/ProductOffers";
import { BonusesProvider } from "./context/BonusesContext";
import { AuthProvider } from "./context/AuthContext";
import {
  LanguageProvider,
  useLang,
} from "./context/LanguageContext";

import SiteSearch from "./components/SiteSearch";
import Header from "./components/Header";
import CookieConsent from "./components/CookieConsent";
import BonusGuard from "./components/BonusGuard";
import ProtectedGuard from "./components/ProtectedGuard";
import ForumGuard from "./components/ForumGuard";
import ForumRegister from "./pages/ForumRegister";
import ForumRules from "./pages/ForumRules";

import FAQ from "./pages/FAQ";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import CookiePolicy from "./pages/CookiePolicy";
import Welcome from "./pages/Welcome";
import AboutUs from "./pages/AboutUs";
import Services from "./pages/Services";
import Contacts from "./pages/Contacts";
import TermsAndConditions from "./pages/TermsAndConditions";
import Bonuses from "./pages/Bonuses";
import BonusAds from "./pages/BonusAds";
import BonusResearch from "./pages/BonusResearch";
import ResearchDirection from "./pages/ResearchDirection";
import Profile from "./pages/Profile";
import TopicsPage from "./pages/TopicsPage";
import Topic from "./pages/Topic";
import Login from "./pages/Login";
import Register from "./pages/Register";
import VerifyEmail from "./pages/VerifyEmail";
import ReviewEntry from "./pages/ReviewEntry";
import ModerationCenter from "./pages/ModerationCenter";
import DemoClosed from "./components/DemoClosed";
import ReviewHistory from './pages/ReviewHistory';
import Shop from "./pages/Shop";
import PartnerNotConnected from "./pages/PartnerNotConnected";
import Dashboard from "./pages/Dashboard";

export function AppRoutes() {
  const { lang, setLang } = useLang();
  const L = lang.toUpperCase();

  return (
    <>
      <Header />
      <CookieConsent />

      <Routes>
        <Route path="/activity-limits" element={<ActivityRules/>}/>
        <Route path="/forum/reviews/new" element={process.env.REACT_APP_DEMO_ONLY==='true'&&process.env.REACT_APP_LOCAL_DEMO_REVIEWS!=='true'?<DemoClosed/>:<ReviewEntry />} />
        <Route path="/forum/reviews/history" element={<ReviewHistory/>}/>
        <Route path="/forum/moderation" element={process.env.REACT_APP_DEMO_ONLY==='true'?<DemoClosed/>:<ModerationCenter />} />
        <Route path="/" element={<Welcome lang={L} />} />
        <Route path="/welcome" element={<Welcome lang={L} />} />
        <Route path="/product-offers" element={<ProductOffers />} />

        <Route path="/about" element={<AboutUs lang={lang} />} />
        <Route path="/services" element={<Services lang={lang} />} />
        <Route path="/contacts" element={<Contacts lang={lang} />} />
        <Route path="/privacy" element={<PrivacyPolicy lang={L} />} />
        <Route path="/search" element={<SiteSearch resultsPage />} />
        <Route path="/faq" element={<FAQ lang={L} />} />
        <Route path="/cookies" element={<CookiePolicy />} />
        <Route path="/terms" element={<TermsAndConditions />} />
        <Route path="/forum/rules" element={<ForumRules />} />

        <Route
          path="/login"
          element={<Login lang={L} onLangChange={setLang} />}
        />
        <Route
          path="/register"
          element={process.env.REACT_APP_DEMO_ONLY==='true'&&process.env.REACT_APP_LOCAL_DEMO_REVIEWS!=='true'?<DemoClosed/>:<Register lang={L} onLangChange={setLang} />}
        />
        <Route
          path="/verify-email"
          element={<VerifyEmail lang={L} />}
        />

        {/* Открытый просмотр.
            Авторизация проверяется при целевом действии. */}
        <Route path="/shop" element={<Shop lang={L} />} />
        <Route path="/bonuses" element={<Bonuses />} />
        <Route path="/bonuses/ads" element={<BonusAds />} />
        <Route
          path="/bonuses/research"
          element={<BonusResearch />}
        />

        {/* Само участие в исследовании остаётся защищённым.
            BonusGuard сохраняет исходную проверку доступа. */}
        <Route
          path="/bonuses/research/:directionId"
          element={<BonusGuard />}
        >
          <Route index element={<ResearchDirection />} />
        </Route>

        {/* Авторизация и подтверждение почты */}
        <Route element={<ProtectedGuard />}>
          <Route path="/profile" element={<Profile />} />
          <Route
            path="/forum/register"
            element={process.env.REACT_APP_DEMO_ONLY==='true'&&process.env.REACT_APP_LOCAL_DEMO_REVIEWS!=='true'?<DemoClosed/>:<ForumRegister />}
          />
          <Route
            path="/dashboard"
            element={<Dashboard lang={L} />}
          />
        </Route>

        {/* Форум: существующая защита без изменений */}
        <Route element={<ForumGuard readOnly />}>
          <Route path="/forum">
            <Route
              index
              element={
                <TopicsPage lang={L} onLangChange={setLang} />
              }
            />
            <Route
              path="topics"
              element={
                <TopicsPage lang={L} onLangChange={setLang} />
              }
            />
            <Route
              path="topics/:id"
              element={<Topic lang={L} onLangChange={setLang} />}
            />
            <Route
              path="topic/:id"
              element={<Topic lang={L} onLangChange={setLang} />}
            />
          </Route>

          <Route
            path="/topic/:id"
            element={<Topic lang={L} onLangChange={setLang} />}
          />
        </Route>

        <Route
          path="/partner-not-connected"
          element={<PartnerNotConnected />}
        />
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
          <BonusesProvider><AppRoutes /></BonusesProvider>
        </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}
