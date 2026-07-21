import { useLocation, useNavigate } from 'react-router-dom';
import Logo from './Logo.jsx';

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

  return (
    <footer className="lp-footer">
      <div className="lp-footer-inner">
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
      </div>
      <div className="lp-footer-legal">© {new Date().getFullYear()} HusAI. All rights reserved.</div>
    </footer>
  );
}
