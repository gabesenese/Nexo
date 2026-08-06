import { useEffect, useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import { SourcesPage } from "./pages/Sources";
import { ConversationsPage } from "./pages/Conversations";
import { AnalyticsPage } from "./pages/Analytics";
import { LeadsPage } from "./pages/Leads";
import { LoginPage } from "./pages/Login";
import { api } from "./api";

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
  const [authState, setAuthState] = useState<"loading" | "anon" | "authed">("loading");
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    api.me().then((result) => {
      if (result) {
        setEmail(result.email);
        setAuthState("authed");
      } else {
        setAuthState("anon");
      }
    });
  }, []);

  async function handleLogout() {
    await api.logout().catch(() => {});
    setEmail(null);
    setAuthState("anon");
  }

  if (authState === "loading") {
    return (
      <div className="login-screen">
        <p className="empty-note">Loading…</p>
      </div>
    );
  }

  if (authState === "anon") {
    return (
      <LoginPage
        onLoggedIn={(loggedInEmail) => {
          setEmail(loggedInEmail);
          setAuthState("authed");
        }}
      />
    );
  }

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
          <NavLink to="/leads">
            <span className="dot" />
            Leads
          </NavLink>
        </div>
        <div className="sidebar-spacer" />
        <div className="sidebar-email">{email}</div>
        <button className="sidebar-logout" onClick={handleLogout}>
          Log out
        </button>
      </nav>
      <main className="content">
        <Routes>
          <Route path="/" element={<AnalyticsPage />} />
          <Route path="/sources" element={<SourcesPage />} />
          <Route path="/conversations" element={<ConversationsPage />} />
          <Route path="/leads" element={<LeadsPage />} />
        </Routes>
      </main>
    </div>
  );
}
