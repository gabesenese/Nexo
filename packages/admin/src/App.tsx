import { useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { SourcesPage } from "./pages/Sources";
import { ConversationsPage } from "./pages/Conversations";
import { AnalyticsPage } from "./pages/Analytics";
import { KnowledgeGapsPage } from "./pages/KnowledgeGaps";
import { ImpactPage } from "./pages/Impact";
import { LeadsPage } from "./pages/Leads";
import { LoginPage } from "./pages/Login";
import { SignupPage } from "./pages/Signup";
import { SettingsPage } from "./pages/Settings";
import { InviteAcceptPage } from "./pages/InviteAccept";
import { OnboardingWizard } from "./onboarding/OnboardingWizard";
import { NotificationBell } from "./components/NotificationBell";
import { api, type AuthUser } from "./api";

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

function AuthScreen({ mode }: { mode: "login" | "signup" }) {
  const navigate = useNavigate();
  const onAuthed = () => navigate("/", { replace: true });
  return mode === "signup" ? <SignupPage onAuthed={onAuthed} /> : <LoginPage onAuthed={onAuthed} />;
}

function Dashboard() {
  const [authState, setAuthState] = useState<"loading" | "anon" | "authed">("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.me().then((result) => {
      if (result) {
        setUser(result);
        setAuthState("authed");
      } else {
        setAuthState("anon");
      }
    });
  }, []);

  async function handleLogout() {
    await api.logout().catch(() => {});
    setUser(null);
    navigate("/login", { replace: true });
  }

  if (authState === "loading") {
    return (
      <div className="login-screen">
        <p className="empty-note">Loading…</p>
      </div>
    );
  }

  if (authState === "anon") {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="app">
      <nav className="sidebar">
        <div className="brand">
          <LogoMark />
          Nexo
        </div>
        <div className="sidebar-topbar">
          <div className="workspace-name">{user?.organization.name}</div>
          <NotificationBell />
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
          <NavLink to="/knowledge-gaps">
            <span className="dot" />
            Knowledge gaps
          </NavLink>
          <NavLink to="/impact">
            <span className="dot" />
            Impact
          </NavLink>
          <NavLink to="/conversations">
            <span className="dot" />
            Conversations
          </NavLink>
          <NavLink to="/leads">
            <span className="dot" />
            Leads
          </NavLink>
          <NavLink to="/settings">
            <span className="dot" />
            Settings
          </NavLink>
        </div>
        <div className="sidebar-spacer" />
        <div className="sidebar-email">{user?.email}</div>
        <button className="sidebar-logout" onClick={handleLogout}>
          Log out
        </button>
      </nav>
      <main className="content">
        <Routes>
          <Route path="/" element={<AnalyticsPage />} />
          <Route path="/sources" element={<SourcesPage />} />
          <Route path="/knowledge-gaps" element={<KnowledgeGapsPage />} />
          <Route path="/impact" element={<ImpactPage />} />
          <Route path="/conversations" element={<ConversationsPage />} />
          <Route path="/leads" element={<LeadsPage />} />
          <Route
            path="/settings"
            element={
              <SettingsPage
                onWorkspaceRenamed={(name) =>
                  setUser((u) => (u ? { ...u, organization: { ...u.organization, name } } : u))
                }
              />
            }
          />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/onboarding/*" element={<OnboardingWizard />} />
      <Route path="/signup" element={<AuthScreen mode="signup" />} />
      <Route path="/login" element={<AuthScreen mode="login" />} />
      <Route path="/invite/:token" element={<InviteAcceptPage />} />
      <Route path="/*" element={<Dashboard />} />
    </Routes>
  );
}
