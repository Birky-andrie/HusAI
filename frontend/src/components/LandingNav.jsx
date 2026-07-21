import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Logo from './Logo.jsx';

const SECTIONS = [
  ['how', 'How it works'],
  ['features', 'Features'],
  ['pricing', 'Pricing'],
  ['faq', 'FAQ'],
];

/**
 * Landing header — reused on the landing page AND the auth pages so the chrome
 * stays consistent. Section links scroll when already on the landing page;
 * from any other route they navigate home and hand the target to the landing
 * via router state (LandingPage scrolls to it on arrival).
 */
export default function LandingNav({ onGetStarted, startDisabled }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const onLanding = location.pathname === '/';
  const start = onGetStarted || (() => navigate('/register'));

  const goSection = (id) => {
    setMenuOpen(false);
    if (onLanding) document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else navigate('/', { state: { scrollTo: id } });
  };
  const goHome = () => {
    setMenuOpen(false);
    if (onLanding) document.getElementById('lp-top')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else navigate('/');
  };

  return (
    <header className="lp-nav">
      <div className="lp-nav-inner">
        <button className="lp-brand" onClick={goHome} aria-label="HusAI home">
          <Logo size={28} />
        </button>
        <nav className="lp-nav-links">
          {SECTIONS.map(([id, label]) => (
            <button key={id} onClick={() => goSection(id)}>
              {label}
            </button>
          ))}
        </nav>
        <div className="lp-nav-actions">
          <button className="lp-link" onClick={() => navigate('/login')}>
            Sign in
          </button>
          <button className="primary" onClick={start} disabled={startDisabled}>
            Get Started
          </button>
        </div>
        <button
          className="lp-menu-btn"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
        >
          {menuOpen ? '✕' : '☰'}
        </button>
      </div>
      {menuOpen && (
        <div className="lp-mobile-menu">
          {SECTIONS.map(([id, label]) => (
            <button key={id} onClick={() => goSection(id)}>
              {label}
            </button>
          ))}
          <div className="lp-mobile-divider" />
          <button onClick={() => { setMenuOpen(false); navigate('/login'); }}>Sign in</button>
          <button className="primary" onClick={() => { setMenuOpen(false); start(); }} disabled={startDisabled}>
            Get Started
          </button>
        </div>
      )}
    </header>
  );
}
