import { useEffect, useRef, useState } from "react";
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { SourcesPage } from "./pages/Sources";
import { ConversationsPage } from "./pages/Conversations";
import { AnalyticsPage } from "./pages/Analytics";
import { KnowledgeGapsPage } from "./pages/KnowledgeGaps";
import { ImpactPage } from "./pages/Impact";
import { TrialBanner } from "./components/TrialBanner";
import { UsageBanner } from "./components/UsageBanner";
import { LeadsPage } from "./pages/Leads";
import { LoginPage } from "./pages/Login";
import { SignupPage } from "./pages/Signup";
import { SettingsPage } from "./pages/Settings";
import { InviteAcceptPage } from "./pages/InviteAccept";
import { ForgotPasswordPage } from "./pages/ForgotPassword";
import { ResetPasswordPage } from "./pages/ResetPassword";
import { OnboardingWizard } from "./onboarding/OnboardingWizard";
import { NotificationBell } from "./components/NotificationBell";
import { api, type AuthUser, type OverviewSummary } from "./api";
import { Mark } from "./components/Mark";
import { ThemeToggle } from "./components/ThemeToggle";
import { useMotion } from "./useMotion";


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
  const [summary, setSummary] = useState<OverviewSummary | null>(null);

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  /**
   * The counts beside the nav come from the same summary the Overview reads, so
   * the sidebar can never disagree with the page. Re-fetched on navigation
   * because working through the inbox is what changes them.
   */
  useEffect(() => {
    if (authState !== "authed") return;
    let live = true;
    api.getOverview().then((result) => {
      if (live) setSummary(result);
    });
    return () => {
      live = false;
    };
  }, [authState, location.pathname]);

  /**
   * Keyed on the path alone. Switching a tab within a page is not an arrival,
   * and re-running the reveal there made the whole screen restart behind a pill
   * that was only meant to slide.
   */
  useMotion(location.pathname);

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
        <div className="sidebar-head">
          <div className="brand">
            <span className="brand-badge" aria-hidden="true">
              <Mark size={16} stroke="var(--on-nav-accent)" />
            </span>
            <span className="brand-id">
              <span className="brand-name">Nexo</span>
            </span>
          </div>
          <div className="sidebar-topbar">
            <ThemeToggle />
            <NotificationBell />
          </div>
        </div>
        {/**
         * The workspace name gets its own row: squeezed beside the controls it
         * was the first thing to truncate, and it is the one label that tells
         * an operator whose data they are looking at.
         */}
        <div className="workspace-name" title={user?.organization.name}>
          {user?.organization.name}
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
              <span>Inbox</span>
              {!!summary?.counts.waitingOnHuman && (
                <span className="nav-count waiting">{summary.counts.waitingOnHuman}</span>
              )}
            </NavLink>
          </div>

          <div className="nav-group">
            <span className="nav-group-label">Knowledge</span>
            <NavLink to="/sources">
              <span className="dot" />
              <span>Sources</span>
              {!!summary?.sourceHealth.total && (
                <span className="nav-count">{summary.sourceHealth.total}</span>
              )}
            </NavLink>
            <NavLink to="/knowledge-gaps">
              <span className="dot" />
              <span>Knowledge gaps</span>
              {!!summary?.knowledgeHealth.total && (
                <span className="nav-count">{summary.knowledgeHealth.total}</span>
              )}
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
        <div className="sidebar-foot">
          <span className="sidebar-avatar" aria-hidden="true">
            {(user?.name || user?.email || "?").trim().charAt(0).toUpperCase()}
          </span>
          <span className="sidebar-id">
            <span className="sidebar-who" title={user?.email}>
              {user?.name || user?.email}
            </span>
            <span className="sidebar-role">{user?.role}</span>
          </span>
          <button className="sidebar-logout" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </nav>
      {/**
       * Keyed on the path so each page fades in rather than snapping into
       * place, and scrolled back to the top on arrival. Without the reset a
       * click from halfway down one page dropped you halfway down the next,
       * which is most of what read as the screen flicking.
       */}
      <main className="content" key={location.pathname} ref={contentRef}>
        <TrialBanner />
        <UsageBanner />
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
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
      <Route path="/invite/:token" element={<InviteAcceptPage />} />
      <Route path="/*" element={<Dashboard />} />
    </Routes>
  );
}
