import { useEffect, useState } from 'react';
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
  const [scrolled, setScrolled] = useState(false);
  const onLanding = location.pathname === '/';
  const start = onGetStarted || (() => navigate('/register'));

  // NOTE: this pill used to carry real liquid-glass refraction. It was removed
  // when the WebGL beam field landed: an SVG-filtered backdrop only costs
  // anything when what is behind it changes, and a canvas that repaints every
  // frame invalidates it every frame. Measured over a full-page scroll, the two
  // refracting pills together ran 16.7ms median with 11 dropped frames; leaving
  // refraction on the draggable Listening pill alone gives 8.3ms and none.
  // The rim bend was never visible on a 45px bar that spends most of its life
  // behind the scrolled nav's own frosted backdrop, so this costs nothing to
  // look at. It keeps the CSS glass dressing below.

  // The bar itself is transparent over the hero, the way the reference is, and
  // earns a frosted backdrop only once content is passing underneath it —
  // otherwise a sticky bar with no surface would let cards collide with links.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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
    <header className={`lp-nav${scrolled ? ' scrolled' : ''}`}>
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
