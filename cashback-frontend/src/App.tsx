import "./App.css";
import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import { AuthProvider } from "./context/AuthContext";

/* Main pages */
import Welcome from "./pages/Welcome";

/* Bonuses */
import Bonuses from "./pages/Bonuses";
import BonusAds from "./pages/BonusAds";
import BonusResearch from "./pages/BonusResearch";

/* Auth */
import Register from "./pages/Register";
import Login from "./pages/Login";

/* Info pages */
import AboutUs from "./pages/AboutUs";
import Services from "./pages/Services";
import Forum from "./pages/Forum";
import Contacts from "./pages/Contacts";

/* Forum-specific */
import ForumRegister from "./pages/ForumRegister";
import Profile from "./pages/Profile";

/* Legal */
import TermsAndConditions from "./pages/TermsAndConditions";

/* Components */
import CookieConsent from "./components/CookieConsent";
import Header from "./components/Header";

function App() {
  const [lang, setLang] = useState("en");

  return (
    <AuthProvider>
      <Router>
        <Header lang={lang} setLang={setLang} />

        <CookieConsent />

        <Routes>
          {/* Main */}
          <Route path="/" element={<Welcome lang={lang} />} />
          <Route path="/welcome" element={<Welcome lang={lang} />} />

          {/* Bonuses */}
          <Route path="/bonuses" element={<Bonuses />} />
          <Route path="/bonuses/ads" element={<BonusAds />} />
          <Route path="/bonuses/research" element={<BonusResearch />} />

          {/* Auth */}
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />

          {/* Info Pages */}
          <Route path="/about" element={<AboutUs lang={lang} />} />
          <Route path="/services" element={<Services lang={lang} />} />
          <Route path="/forum" element={<Forum lang={lang} />} />
          <Route path="/contacts" element={<Contacts lang={lang} />} />

          {/* Forum-specific */}
          <Route path="/forum-register" element={<ForumRegister />} />
          <Route path="/profile" element={<Profile />} />

          {/* Legal (hidden from header) */}
          <Route path="/terms" element={<TermsAndConditions />} />

          {/* Fallback */}
          <Route
            path="*"
            element={
              <div style={{ padding: "40px", fontSize: "20px" }}>
                Page not found
              </div>
            }
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
