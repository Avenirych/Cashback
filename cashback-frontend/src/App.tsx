import "./App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import { AuthProvider } from "./context/AuthContext";
import { LanguageProvider, useLang } from "./context/LanguageContext";

import Header from "./components/Header";
import CookieConsent from "./components/CookieConsent";

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

function AppRoutes() {
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

        <Route path="/bonuses" element={<Bonuses />} />
        <Route path="/bonuses/ads" element={<BonusAds />} />
        <Route path="/bonuses/research" element={<BonusResearch />} />
        <Route path="/profile" element={<Profile />} />

        <Route path="/forum" element={<TopicsPage lang={L} onLangChange={setLang} />} />
        <Route path="/topic/:id" element={<Topic lang={L} onLangChange={setLang} />} />

        <Route path="/login" element={<Login lang={L} onLangChange={setLang} />} />
        <Route path="/register" element={<Register lang={L} onLangChange={setLang} />} />

        <Route path="*" element={<Welcome lang={L} />} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;
