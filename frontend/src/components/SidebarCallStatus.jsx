import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCallSession } from '../call/CallSessionContext.jsx';

function fmtElapsed(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = String(Math.floor(total / 60)).padStart(2, '0');
  const sec = String(total % 60).padStart(2, '0');
  return `${m}:${sec}`;
}

/**
 * Sidebar-only: when a call is running (on ANY page, per CallSessionContext
 * living above the router), show it as a calm, clickable status that returns
 * to /call. Reads existing call state — starts nothing, changes nothing.
 */
export default function SidebarCallStatus({ onNavigate }) {
  const call = useCallSession();
  const navigate = useNavigate();
  const [, forceTick] = useState(0);

  useEffect(() => {
    if (!call.callActive) return undefined;
    const id = setInterval(() => forceTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [call.callActive]);

  if (!call.callActive) return null;

  const elapsed = call.callStartedAt ? Date.now() - call.callStartedAt : 0;

  return (
    <button
      className="side-live"
      onClick={() => {
        onNavigate?.();
        navigate('/call');
      }}
      title="Return to your live coaching session"
    >
      <span className="side-live-head">
        <span className="side-live-dot" aria-hidden="true" />
        <span className="side-live-label">Live Coaching</span>
        <span className="side-live-time">{fmtElapsed(elapsed)}</span>
      </span>
      <span className="side-live-sub">Microphone active · Lifeline on</span>
    </button>
  );
}
