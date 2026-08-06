import { NavLink, Route, Routes } from "react-router-dom";
import { SourcesPage } from "./pages/Sources";
import { ConversationsPage } from "./pages/Conversations";
import { AnalyticsPage } from "./pages/Analytics";

function LogoMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="9" stroke="#2f6f5e" strokeWidth="1.4" />
      <path
        d="M6 13V7l8 6V7"
        stroke="#f6f4ee"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function App() {
  return (
    <div className="app">
      <nav className="sidebar">
        <div className="brand">
          <LogoMark />
          Nexo
        </div>
        <div className="nav-links">
          <NavLink to="/" end>
            <span className="dot" />
            Overview
          </NavLink>
          <NavLink to="/sources">
            <span className="dot" />
            Knowledge
          </NavLink>
          <NavLink to="/conversations">
            <span className="dot" />
            Conversations
          </NavLink>
        </div>
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
