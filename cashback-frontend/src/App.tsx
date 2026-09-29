import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./theme/ThemeContext";
import "./theme/theme.css";

import Menu from "./components/Menu";

import Home from "./pages/Home";
import BestOffers from "./pages/BestOffers";
import Catalog from "./pages/Catalog";
import ProductPage from "./pages/ProductPage";
import Compare from "./pages/Compare";
import Search from "./pages/Search";
import Partners from "./pages/Partners";
import Transactions from "./pages/Transactions";
import Clicks from "./pages/Clicks";
import Offers from "./pages/Offers";
import Analytics from "./pages/Analytics";
import Profile from "./pages/Profile";

export default function App() {
  return (
    <ThemeProvider>
      <Router>
        <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>
          <Menu />
          <main style={{ padding: "20px", flexGrow: 1 }}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/best" element={<BestOffers />} />
              <Route path="/catalog" element={<Catalog />} />
              <Route path="/product/:id" element={<ProductPage />} />
              <Route path="/compare" element={<Compare />} />
              <Route path="/search" element={<Search />} />
              <Route path="/partners" element={<Partners />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/clicks" element={<Clicks />} />
              <Route path="/offers" element={<Offers />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/profile" element={<Profile />} />
            </Routes>
          </main>
        </div>
      </Router>
    </ThemeProvider>
  );
}
