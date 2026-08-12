import { useEffect, useRef, useState } from "react";
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { SourcesPage } from "./pages/Sources";
import { ConversationsPage } from "./pages/Conversations";
import { AnalyticsPage } from "./pages/Analytics";
import { KnowledgeGapsPage } from "./pages/KnowledgeGaps";
import { ImpactPage } from "./pages/Impact";
import { TrialBanner } from "./components/TrialBanner";
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
  const location = useLocation();
  const contentRef = useRef<HTMLElement>(null);

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

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
        {/**
         * Grouped by what the operator is doing, and the Inbox sits second
         * rather than fifth: it is the surface they work in all day, and a flat
         * list of seven identical rows gave it no more weight than Leads.
         */}
        <nav className="nav-links" aria-label="Main">
          <div className="nav-group">
            <span className="nav-group-label">Today</span>
            <NavLink to="/" end>
              <span className="dot" />
              Overview
            </NavLink>
            <NavLink to="/conversations">
              <span className="dot" />
              Inbox
            </NavLink>
          </div>

          <div className="nav-group">
            <span className="nav-group-label">Knowledge</span>
            <NavLink to="/sources">
              <span className="dot" />
              Sources
            </NavLink>
            <NavLink to="/knowledge-gaps">
              <span className="dot" />
              Knowledge gaps
            </NavLink>
          </div>

          <div className="nav-group">
            <span className="nav-group-label">Workspace</span>
            <NavLink to="/impact">
              <span className="dot" />
              Impact
            </NavLink>
            {/** Leads is not part of the support loop yet, so it sits here rather than beside the Inbox. */}
            <NavLink to="/leads">
              <span className="dot" />
              Leads
            </NavLink>
            <NavLink to="/settings">
              <span className="dot" />
              Settings
            </NavLink>
          </div>
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-email">{user?.email}</div>
        <button className="sidebar-logout" onClick={handleLogout}>
          Log out
        </button>
      </nav>
      {/**
       * Keyed on the path so each page fades in rather than snapping into
       * place, and scrolled back to the top on arrival. Without the reset a
       * click from halfway down one page dropped you halfway down the next,
       * which is most of what read as the screen flicking.
       */}
      <main className="content" key={location.pathname} ref={contentRef}>
        <TrialBanner />
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
