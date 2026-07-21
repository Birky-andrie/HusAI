import { useState } from 'react';
import { Routes, Route, NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import usePlatform from './hooks/usePlatform.js';
import { useAuth } from './auth/AuthContext.jsx';
import RequireAuth from './auth/RequireAuth.jsx';
import Logo from './components/Logo.jsx';
import LandingPage from './components/LandingPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import CallPage from './pages/CallPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import VerifyEmailPage from './pages/VerifyEmailPage.jsx';
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx';
import ResetPasswordPage from './pages/ResetPasswordPage.jsx';
import OAuthCompletePage from './pages/OAuthCompletePage.jsx';
import HistoryPage from './pages/HistoryPage.jsx';
import HistoryDetailPage from './pages/HistoryDetailPage.jsx';
import PracticePage from './pages/PracticePage.jsx';
import PracticeSessionPage from './pages/PracticeSessionPage.jsx';
import ProgressPage from './pages/ProgressPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';

// Minimal inline nav icons (stroke, currentColor) — visual only.
const svg = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };
const IconDash = () => (<svg {...svg}><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></svg>);
const IconMic = () => (<svg {...svg}><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0M12 17v4" /></svg>);
const IconSessions = () => (<svg {...svg}><path d="M3 3v18h18" /><rect x="7" y="12" width="3" height="6" rx="1" /><rect x="12.5" y="8" width="3" height="10" rx="1" /><rect x="18" y="5" width="3" height="13" rx="1" /></svg>);
const IconPractice = () => (<svg {...svg}><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM19 17H6a2 2 0 0 0-2 2" /></svg>);
const IconProgress = () => (<svg {...svg}><path d="M3 17l6-6 4 4 8-8M17 7h4v4" /></svg>);
const IconSettings = () => (<svg {...svg}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>);

const NAV = [
  { to: '/dashboard', label: 'Dashboard', Icon: IconDash },
  { to: '/call', label: 'Live Coach', Icon: IconMic, live: true },
  { to: '/history', label: 'Sessions', Icon: IconSessions },
  { to: '/practice', label: 'Practice', Icon: IconPractice },
  { to: '/progress', label: 'Progress', Icon: IconProgress },
  { to: '/settings', label: 'Settings', Icon: IconSettings },
];

function Landing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  return <LandingPage onStart={() => navigate(user ? '/dashboard' : '/register')} />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/oauth-complete" element={<OAuthCompletePage />} />
      <Route path="/dashboard" element={<RequireAuth><DashboardPage /></RequireAuth>} />
      <Route path="/call" element={<RequireAuth><CallPage /></RequireAuth>} />
      <Route path="/history" element={<RequireAuth><HistoryPage /></RequireAuth>} />
      <Route path="/history/:id" element={<RequireAuth><HistoryDetailPage /></RequireAuth>} />
      <Route path="/practice" element={<RequireAuth><PracticePage /></RequireAuth>} />
      <Route path="/practice/:id" element={<RequireAuth><PracticeSessionPage /></RequireAuth>} />
      <Route path="/progress" element={<RequireAuth><ProgressPage /></RequireAuth>} />
      <Route path="/settings" element={<RequireAuth><SettingsPage /></RequireAuth>} />
      <Route path="*" element={<Landing />} />
    </Routes>
  );
}

export default function App() {
  const platform = usePlatform();
  const isDesktop = platform === 'desktop';
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  const signOut = async () => {
    closeMenu();
    await logout();
    navigate('/');
  };

  const startSession = () => {
    closeMenu();
    navigate('/call');
  };

  // Authed → sidebar shell (off-canvas drawer on mobile); public → centered layout.
  if (user) {
    return (
      <div className="app-shell">
        <div className="mobile-topbar">
          <button className="menu-btn" onClick={() => setMenuOpen(true)} aria-label="Open menu" aria-expanded={menuOpen}>
            ☰
          </button>
          <Link to="/call" className="brand" onClick={closeMenu}>
            <Logo size={26} />
          </Link>
        </div>

        {menuOpen && <div className="drawer-backdrop" onClick={closeMenu} aria-hidden="true" />}

        <aside className={`sidebar${menuOpen ? ' open' : ''}`}>
          <Link to="/dashboard" className="side-brand" onClick={closeMenu}>
            <Logo size={30} />
          </Link>
          <button className="primary side-cta" onClick={startSession}>
            Start New Session
          </button>
          <nav className="side-nav">
            {NAV.map(({ to, label, Icon, live }) => (
              <NavLink key={to} to={to} onClick={closeMenu}>
                <Icon />
                <span>{label}</span>
                {live && <span className="nav-live">LIVE</span>}
              </NavLink>
            ))}
          </nav>
          <div className="side-spacer" />
          <div className="side-foot">
            <span className="side-badge">{isDesktop ? 'Desktop app' : 'Web app'}</span>
            <button className="secondary" onClick={signOut}>Sign out</button>
          </div>
        </aside>

        <main className="sidebar-main">
          <AppRoutes />
        </main>
      </div>
    );
  }

  // Auth pages keep the centred chrome; the landing (and catch-all) renders
  // full-bleed so its funnel sections span the whole viewport.
  const AUTH_PATHS = ['/login', '/register', '/verify-email', '/forgot-password', '/reset-password', '/oauth-complete'];
  if (AUTH_PATHS.includes(pathname)) {
    return (
      <div className="app">
        <div className="public-top">
          <Link to="/" className="brand">
            <Logo size={28} />
          </Link>
          <span className="grow" />
          <Link to="/login" className="header-auth link-button">
            Sign in
          </Link>
        </div>
        <AppRoutes />
      </div>
    );
  }

  return <AppRoutes />;
}
