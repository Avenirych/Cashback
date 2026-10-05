import { BrowserRouter, Routes, Route } from "react-router-dom";

import TopicsPage from "./pages/TopicsPage";
import Topic from "./pages/Topic";
import Login from "./pages/Login";
import Register from "./pages/Register";
import { AuthProvider } from "./context/AuthContext";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<TopicsPage />} />
          <Route path="/topic/:id" element={<Topic />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
