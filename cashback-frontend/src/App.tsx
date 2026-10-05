import { BrowserRouter, Routes, Route } from "react-router-dom";

import Welcome from "./pages/Welcome";
import TopicsPage from "./pages/TopicsPage";
import Topic from "./pages/Topic";
import Login from "./pages/Login";
import Register from "./pages/Register";
import HowItWorks from "./pages/HowItWorks";
import About from "./pages/About";
import { AuthProvider } from "./context/AuthContext";
import { LangProvider, useLang } from "./context/LangContext";

function AppRoutes() {
  const { lang, setLang } = useLang();
  const L = lang.toUpperCase();

  return (
    <Routes>
      <Route path="/" element={<Welcome lang={L} />} />
      <Route path="/forum" element={<TopicsPage lang={L} onLangChange={setLang} />} />
      <Route path="/topic/:id" element={<Topic lang={L} onLangChange={setLang} />} />
      <Route path="/login" element={<Login lang={L} onLangChange={setLang} />} />
      <Route path="/register" element={<Register lang={L} onLangChange={setLang} />} />
      <Route path="/how-it-works" element={<HowItWorks />} />
      <Route path="/about" element={<About />} />
      <Route path="*" element={<Welcome lang={L} />} />
    </Routes>
  );
}

function App() {
  return (
    <LangProvider>
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
    </LangProvider>
  );
}

export default App;
