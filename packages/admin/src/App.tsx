import { NavLink, Route, Routes } from "react-router-dom";
import { SourcesPage } from "./pages/Sources";
import { ConversationsPage } from "./pages/Conversations";
import { AnalyticsPage } from "./pages/Analytics";

export default function App() {
  return (
    <div className="app">
      <nav className="sidebar">
        <div className="brand">Nexo</div>
        <NavLink to="/" end>
          Analytics
        </NavLink>
        <NavLink to="/sources">Sources</NavLink>
        <NavLink to="/conversations">Conversations</NavLink>
      </nav>
      <main className="content">
        <Routes>
          <Route path="/" element={<AnalyticsPage />} />
          <Route path="/sources" element={<SourcesPage />} />
          <Route path="/conversations" element={<ConversationsPage />} />
        </Routes>
      </main>
    </div>
  );
}
