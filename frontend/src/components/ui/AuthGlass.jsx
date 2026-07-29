import { Link } from 'react-router-dom';
import Logo from '../Logo.jsx';

/**
 * The shared full-bleed glass auth surface: drifting colour fields, the brand
 * mark, and the centred column. Sign-in and sign-up both render into it, so the
 * background, entrance stagger, and column width stay identical between them
 * without either page owning the chrome.
 *
 * Styles live in components/auth.css under the same `auth-glass-` prefix.
 */
export function AuthGlassShell({ children }) {
  return (
    <div className="auth-glass">
      <div className="auth-glass-bg" aria-hidden="true">
        <span className="auth-glass-blob a" />
        <span className="auth-glass-blob b" />
        <span className="auth-glass-blob c" />
      </div>

      <Link to="/" className="auth-glass-brand">
        <Logo size={26} />
      </Link>

      <div className="auth-glass-inner">
        {/* The entrance stagger is driven by :nth-child on this wrapper, so
            every direct child animates in sequence without per-item wiring. */}
        <div className="auth-glass-step">{children}</div>
      </div>
    </div>
  );
}

const s = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export const IMail = () => (<svg {...s}><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m2 7 10 6 10-6" /></svg>);
export const ILock = () => (<svg {...s}><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>);
export const IUser = () => (<svg {...s}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>);
export const IEye = () => (<svg {...s}><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>);
export const IEyeOff = () => (<svg {...s}><path d="M10.7 5.1A9.9 9.9 0 0 1 12 5c6 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4M6.6 6.6A17.7 17.7 0 0 0 2 12s4 7 10 7a9.7 9.7 0 0 0 5.4-1.6" /><path d="m2 2 20 20" /></svg>);
export const IArrow = () => (<svg {...s}><path d="M5 12h14M13 6l6 6-6 6" /></svg>);
export const IMailSent = () => (<svg {...s} width="34" height="34"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m2 7 10 6 10-6" /></svg>);

export const GoogleMark = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.4a5.5 5.5 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.6-5.2 3.6-8.8Z" />
    <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-3l-3.9-3a7.2 7.2 0 0 1-10.7-3.8h-4v3.1A12 12 0 0 0 12 24Z" />
    <path fill="#FBBC05" d="M5.3 14.2a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.2Z" />
    <path fill="#EA4335" d="M12 4.8c1.8 0 3.4.6 4.6 1.8l3.5-3.5A12 12 0 0 0 1.4 6.6l4 3.1A7.2 7.2 0 0 1 12 4.8Z" />
  </svg>
);

/**
 * A pill-shaped glass input. The leading slot is a plain icon by default, or a
 * real button when the field can reveal itself (password) — which is why the
 * toggle is disabled while the field is empty: a reveal control with nothing to
 * reveal is a control that does nothing visible.
 */
export function GlassField({ icon, toggle, onToggle, toggleLabel, toggleDisabled, ...inputProps }) {
  return (
    <div className="glass-field">
      {toggle ? (
        <button
          type="button"
          className="glass-field-icon as-button"
          onClick={onToggle}
          disabled={toggleDisabled}
          aria-label={toggleLabel}
        >
          {icon}
        </button>
      ) : (
        <span className="glass-field-icon">{icon}</span>
      )}
      <input {...inputProps} />
    </div>
  );
}
