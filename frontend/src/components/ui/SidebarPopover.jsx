import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Minimal anchored flyout for lightweight Sidebar info panels (Upgrade, Help &
 * Support) that have no dedicated page yet. Portaled to <body> and positioned
 * via the trigger's own rect — the sidebar clips overflow-x for its collapse
 * animation, so an inline-positioned panel would be cut off at the rail edge.
 * `trigger` is a render prop: (toggle, open) => <button/link>.
 */
export default function SidebarPopover({ trigger, title, children, className = '' }) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState(null);
  const anchorRef = useRef(null);
  const panelRef = useRef(null);

  const reposition = () => {
    if (anchorRef.current) setRect(anchorRef.current.getBoundingClientRect());
  };

  useLayoutEffect(() => {
    if (open) reposition();
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (anchorRef.current?.contains(e.target) || panelRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open]);

  return (
    <div className={`side-popover-root ${className}`} ref={anchorRef}>
      {trigger(() => setOpen((v) => !v), open)}
      {open &&
        rect &&
        createPortal(
          <div
            className="side-popover-panel"
            role="dialog"
            aria-label={title}
            ref={panelRef}
            style={{ top: rect.bottom + 10, left: Math.min(rect.right + 10, window.innerWidth - 256) }}
          >
            {title && <p className="side-popover-title">{title}</p>}
            {children}
          </div>,
          document.body
        )}
    </div>
  );
}
