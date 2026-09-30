import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import { AuthProvider } from "./context/AuthContext";
import { LangProvider } from "./context/LangContext";

import Welcome from "./pages/Welcome";
import Bonuses from "./pages/Bonuses";
import BonusAds from "./pages/BonusAds";
import BonusResearch from "./pages/BonusResearch";
import Register from "./pages/Register";
import Login from "./pages/Login";
import TermsAndConditions from "./pages/TermsAndConditions";

import CookieConsent from "./components/CookieConsent";

function App() {
  return (
    <AuthProvider>
      <LangProvider>
        <Router>
          {/* Cookie window appears automatically on first visit */}
          <CookieConsent />

          <Routes>
            {/* Welcome page */}
            <Route path="/" element={<Welcome />} />
            <Route path="/welcome" element={<Welcome />} />

            {/* Bonuses */}
            <Route path="/bonuses" element={<Bonuses />} />
            <Route path="/bonuses/ads" element={<BonusAds />} />
            <Route path="/bonuses/research" element={<BonusResearch />} />

            {/* Auth */}
            <Route path="/register" element={<Register />} />
            <Route path="/login" element={<Login />} />

            {/* Terms */}
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
      </LangProvider>
    </AuthProvider>
  );
}

export default App;
