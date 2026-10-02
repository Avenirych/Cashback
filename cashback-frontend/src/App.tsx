import "./App.css";
import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import { AuthProvider } from "./context/AuthContext";

import Welcome from "./pages/Welcome";
import Bonuses from "./pages/Bonuses";
import BonusAds from "./pages/BonusAds";
import BonusResearch from "./pages/BonusResearch";
import Register from "./pages/Register";
import Login from "./pages/Login";
import TermsAndConditions from "./pages/TermsAndConditions";

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
          <Route path="/" element={<Welcome lang={lang} />} />
          <Route path="/welcome" element={<Welcome lang={lang} />} />

          <Route path="/bonuses" element={<Bonuses />} />
          <Route path="/bonuses/ads" element={<BonusAds />} />
          <Route path="/bonuses/research" element={<BonusResearch />} />

          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />

          <Route path="/terms" element={<TermsAndConditions />} />

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
