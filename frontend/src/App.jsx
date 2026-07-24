import { useState } from 'react';
import { Routes, Route, NavLink, Link, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './auth/AuthContext.jsx';
import RequireAuth from './auth/RequireAuth.jsx';
import { CallSessionProvider } from './call/CallSessionContext.jsx';
import Logo from './components/Logo.jsx';
import Avatar from './components/ui/Avatar.jsx';
import { useTheme } from './theme/ThemeProvider.jsx';
import LandingPage from './components/LandingPage.jsx';
import LandingNav from './components/LandingNav.jsx';
import LandingFooter from './components/LandingFooter.jsx';
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
const IconMoon = () => (<svg {...svg}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>);
const IconSun = () => (<svg {...svg}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>);
const IconLogout = () => (<svg {...svg}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>);

const NAV = [
  { to: '/dashboard', label: 'Dashboard', Icon: IconDash },
  { to: '/call', label: 'Live Coach', Icon: IconMic, live: true },
  { to: '/history', label: 'Review', Icon: IconSessions },
  { to: '/practice', label: 'Practice', Icon: IconPractice },
  { to: '/progress', label: 'Progress', Icon: IconProgress },
];

function Landing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  // Signed-in users have no business on the marketing landing — send them to
  // their dashboard. Covers both "/" and the catch-all "*" route.
  if (user) return <Navigate to="/dashboard" replace />;
  return <LandingPage onStart={() => navigate('/register')} />;
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
  const { user, account, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  const signOut = async () => {
    closeMenu();
    await logout();
    navigate('/');
  };

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

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
            <NavLink to="/settings" className="nav-item" onClick={closeMenu}>
              <IconSettings />
              <span>Settings</span>
            </NavLink>
            <button className="side-theme" onClick={toggleTheme} aria-label="Toggle color theme">
              {theme === 'dark' ? <IconSun /> : <IconMoon />}
              <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
            </button>
            <div className="side-profile-row">
              <button
                className="side-profile"
                onClick={() => { closeMenu(); navigate('/settings'); }}
                title="Profile & settings"
              >
                <Avatar src={account?.avatarUrl} name={user.displayName || user.email} size={38} />
                <span className="side-profile-meta">
                  <span className="side-profile-name">{user.displayName || user.email?.split('@')[0]}</span>
                  <span className="side-profile-role">Virtual Assistant</span>
                </span>
              </button>
              <button className="side-signout" onClick={signOut} title="Sign out" aria-label="Sign out">
                <IconLogout />
              </button>
            </div>
          </div>
        </aside>

        <main className="sidebar-main">
          <CallSessionProvider>
            <AppRoutes />
          </CallSessionProvider>
        </main>
      </div>
    );
  }

  // Auth pages share the landing header + footer so the chrome stays consistent;
  // the auth card centres between them. The landing (and catch-all) renders its
  // own nav/footer, so it just renders full-bleed here.
  const AUTH_PATHS = ['/login', '/register', '/verify-email', '/forgot-password', '/reset-password', '/oauth-complete'];
  if (AUTH_PATHS.includes(pathname)) {
    return (
      <div className="lp auth-shell">
        <LandingNav onGetStarted={() => navigate('/register')} />
        <main className="auth-main">
          <AppRoutes />
        </main>
        <LandingFooter onGetStarted={() => navigate('/register')} />
      </div>
    );
  }

  return <AppRoutes />;
}
