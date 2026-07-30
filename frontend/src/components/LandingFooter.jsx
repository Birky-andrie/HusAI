import { useLocation, useNavigate } from 'react-router-dom';
import Logo from './Logo.jsx';
import ScrollReveal from './ui/ScrollReveal.jsx';

/** Landing footer — reused on the landing page and the auth pages. */
export default function LandingFooter({ onGetStarted }) {
  const navigate = useNavigate();
  const location = useLocation();
  const onLanding = location.pathname === '/';
  const start = onGetStarted || (() => navigate('/register'));

  const goSection = (id) => {
    if (onLanding) document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else navigate('/', { state: { scrollTo: id } });
  };

  const footerBrand = (
    <>
      <div className="lp-footer-brand">
        <Logo size={26} />
        <p>Your AI communication coach.</p>
      </div>
      <div className="lp-footer-links">
        <button onClick={() => goSection('features')}>Features</button>
        <button onClick={() => goSection('pricing')}>Pricing</button>
        <button onClick={() => navigate('/login')}>Sign in</button>
        <button onClick={start}>Get Started</button>
      </div>
    </>
  );
  const legalText = <>© {new Date().getFullYear()} HusAI. All rights reserved.</>;

  // Scroll-reveal only applies on the actual landing page — the auth pages
  // reuse this footer as static chrome (matches the scoping the CSS system
  // used before: `.lp-dark .lp-footer-inner`). `margin={null}` disables the
  // reveal's usual "trigger a bit early" viewport shrink: the footer is the
  // last thing on the page, so once you're scrolled all the way down there's
  // no more room for it to satisfy a shrunk trigger region — see ScrollReveal.jsx.
  return (
    <footer className="lp-footer">
      {onLanding ? (
        <ScrollReveal as="div" className="lp-footer-inner" margin={null}>{footerBrand}</ScrollReveal>
      ) : (
        <div className="lp-footer-inner">{footerBrand}</div>
      )}
      {onLanding ? (
        <ScrollReveal as="div" className="lp-footer-legal" delay={0.1} margin={null}>{legalText}</ScrollReveal>
      ) : (
        <div className="lp-footer-legal">{legalText}</div>
      )}
    </footer>
  );
}
