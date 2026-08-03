import { Link } from 'react-router-dom';

/**
 * Wraps a Pro-only feature for free-tier users.
 *
 * The feature is still RENDERED, at 60% opacity, with an upgrade message over
 * it. Showing the real thing (rather than hiding it or swapping in a
 * placeholder) is the point: a user who can see the review they would have got
 * has a concrete reason to upgrade, where an empty state gives them nothing.
 *
 * The children are made inert — `pointer-events: none`, and `inert` so keyboard
 * focus and screen readers skip the decorative copy underneath and land on the
 * upgrade link instead. Without that, tabbing through a locked panel walks the
 * user through controls that do nothing.
 *
 * This is presentation only. Every Pro capability is enforced server-side; a
 * user who deletes this element in devtools gets an unstyled 402, not access.
 */
export default function ProLock({ feature, children, locked = true, note }) {
  if (!locked) return children;

  return (
    <div className="pro-lock">
      <div className="pro-lock-content" inert="" aria-hidden="true">
        {children}
      </div>

      <div className="pro-lock-overlay">
        <div className="pro-lock-card">
          <span className="pro-lock-badge">PRO</span>
          <p className="pro-lock-title">Upgrade to Pro to access {feature}</p>
          {note && <p className="pro-lock-note">{note}</p>}
          <Link className="primary pro-lock-cta" to="/plans">
            See Pro plans
          </Link>
        </div>
      </div>
    </div>
  );
}
