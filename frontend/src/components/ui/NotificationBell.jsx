import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const svg = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };
const IconBell = () => (<svg {...svg}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>);
const ICONS = {
  review: () => (<svg {...svg}><path d="M3 3v18h18" /><path d="M7 14l4-4 3 3 5-6" /></svg>),
  practice: () => (<svg {...svg}><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM19 17H6a2 2 0 0 0-2 2" /></svg>),
  milestone: () => (<svg {...svg}><path d="M3 17l6-6 4 4 8-8M17 7h4v4" /></svg>),
  insight: () => (<svg {...svg}><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10c1 1 1 2 1 3h6c0-1 0-2 1-3a6 6 0 0 0-4-10Z" /></svg>),
  system: () => (<svg {...svg}><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></svg>),
};

function timeAgo(ts) {
  const mins = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : `${days}d ago`;
}

/**
 * Global notification bell + popover. Purely presentational: `items` come from
 * deriveNotifications (or, later, a backend feed) and read-state changes are
 * reported up via `onMarkRead` — this component owns only open/close UI state.
 */
export default function NotificationBell({ items = [], readIds = [], onMarkRead }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const navigate = useNavigate();

  const unread = items.filter((n) => !readIds.includes(n.id));

  // Close on outside click / Escape — standard popover manners.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const openItem = (n) => {
    onMarkRead?.([n.id]);
    setOpen(false);
    if (n.action?.to) navigate(n.action.to);
  };

  return (
    <div className="notif-root" ref={rootRef}>
      <button
        className="notif-bell"
        onClick={() => setOpen((v) => !v)}
        aria-label={unread.length ? `Notifications — ${unread.length} unread` : 'Notifications'}
        aria-expanded={open}
      >
        <IconBell />
        {unread.length > 0 && <span className="notif-dot" aria-hidden="true" />}
      </button>

      {open && (
        <div className="notif-panel" role="dialog" aria-label="Notifications">
          <header className="notif-head">
            <h4>Notifications</h4>
            {unread.length > 0 && (
              <button className="notif-mark-all" onClick={() => onMarkRead?.(items.map((n) => n.id))}>
                Mark all as read
              </button>
            )}
          </header>

          {items.length === 0 ? (
            <div className="notif-empty">
              <p>You're all caught up.</p>
              <span>Reviews, practice tips, and progress milestones land here.</span>
            </div>
          ) : (
            <ul className="notif-list">
              {items.map((n) => {
                const Icon = ICONS[n.type] || ICONS.system;
                const isUnread = !readIds.includes(n.id);
                return (
                  <li key={n.id}>
                    <button className={`notif-item${isUnread ? ' unread' : ''}`} onClick={() => openItem(n)}>
                      <span className={`notif-icon ${n.type}`}><Icon /></span>
                      <span className="notif-meta">
                        <span className="notif-title">{n.title}</span>
                        <span className="notif-body">{n.body}</span>
                        <span className="notif-foot">
                          <time>{timeAgo(n.at)}</time>
                          {n.action && <span className="notif-action">{n.action.label}</span>}
                        </span>
                      </span>
                      {isUnread && <span className="notif-unread-dot" aria-hidden="true" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
