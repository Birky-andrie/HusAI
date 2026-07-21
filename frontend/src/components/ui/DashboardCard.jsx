import { Link } from 'react-router-dom';

/** Titled surface card with an optional header action (link or button). */
export default function DashboardCard({ title, icon, action, className = '', children }) {
  return (
    <section className={`dash-card ${className}`}>
      {(title || action) && (
        <header className="dash-card-head">
          <h3>
            {icon && <span className="dash-card-icon">{icon}</span>}
            {title}
          </h3>
          {action &&
            (action.to ? (
              <Link to={action.to} className="dash-card-action">
                {action.label}
              </Link>
            ) : (
              <button className="dash-card-action" onClick={action.onClick}>
                {action.label}
              </button>
            ))}
        </header>
      )}
      {children}
    </section>
  );
}
