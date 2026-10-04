import { BrowserRouter, Routes, Route } from "react-router-dom";

import TopicsPage from "./pages/TopicsPage";
import Topic from "./pages/Topic";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<TopicsPage />} />
        <Route path="/topic/:id" element={<Topic />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;