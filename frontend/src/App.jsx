import { Routes, Route, NavLink, Link, useNavigate } from 'react-router-dom';
import usePlatform from './hooks/usePlatform.js';
import { useAuth } from './auth/AuthContext.jsx';
import RequireAuth from './auth/RequireAuth.jsx';
import LandingPage from './components/LandingPage.jsx';
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

function Landing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  return <LandingPage onStart={() => navigate(user ? '/call' : '/register')} />;
}

export default function App() {
  const platform = usePlatform();
  const isDesktop = platform === 'desktop';
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="app">
      <header>
        <Link to="/" className="brand">
          <h1>HusAI</h1>
        </Link>
        <span className="tagline">Confidence, On Call.</span>
        {user && (
          <nav className="main-nav">
            <NavLink to="/call">Call</NavLink>
            <NavLink to="/history">History</NavLink>
            <NavLink to="/practice">Practice</NavLink>
            <NavLink to="/progress">Progress</NavLink>
            <NavLink to="/settings">Settings</NavLink>
          </nav>
        )}
        <span className={`platform-badge ${platform}`}>{isDesktop ? 'Desktop' : 'Web'}</span>
        {user ? (
          <button
            className="secondary header-auth"
            onClick={async () => {
              await logout();
              navigate('/');
            }}
          >
            Sign out
          </button>
        ) : (
          <Link to="/login" className="header-auth link-button">
            Sign in
          </Link>
        )}
      </header>

      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/oauth-complete" element={<OAuthCompletePage />} />
        <Route path="/call" element={<RequireAuth><CallPage /></RequireAuth>} />
        <Route path="/history" element={<RequireAuth><HistoryPage /></RequireAuth>} />
        <Route path="/history/:id" element={<RequireAuth><HistoryDetailPage /></RequireAuth>} />
        <Route path="/practice" element={<RequireAuth><PracticePage /></RequireAuth>} />
        <Route path="/practice/:id" element={<RequireAuth><PracticeSessionPage /></RequireAuth>} />
        <Route path="/progress" element={<RequireAuth><ProgressPage /></RequireAuth>} />
        <Route path="/settings" element={<RequireAuth><SettingsPage /></RequireAuth>} />
        <Route path="*" element={<Landing />} />
      </Routes>
    </div>
  );
}
