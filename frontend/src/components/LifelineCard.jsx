import { useState } from 'react';
import MicVisualizer from './ui/MicVisualizer.jsx';

const CopyIcon = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </svg>
);
const CheckIcon = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

function SmartReply({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(text).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1400);
      },
      () => {}
    );
  };
  return (
    <li className="smart-reply">
      <span className="smart-reply-text">{text}</span>
      <button className="smart-reply-copy" onClick={copy} aria-label={copied ? 'Copied' : 'Copy suggestion'} title="Copy">
        {copied ? <CheckIcon /> : <CopyIcon />}
      </button>
    </li>
  );
}

/**
 * The Lifeline: three AI-suggested replies. Suggestions PERSIST while the user
 * talks (see the silence detector) — they only change on manual dismiss, a new
 * set, or session end. `onRefresh` (optional) requests a fresh set.
 */
export default function LifelineCard({ bullets, onDismiss, onRefresh, micStream, active = true, docked = false }) {
  if (!bullets?.length) return null;
  return (
    <div className={`lifeline-card${docked ? ' docked' : ''}`} role="status" aria-live="polite">
      <div className="lifeline-header">
        <span className="lifeline-title-group">
          {micStream !== undefined && <MicVisualizer stream={micStream} active={active} bars={4} label="Listening" />}
          <span className="lifeline-title">Smart Replies</span>
        </span>
        <div className="lifeline-controls">
          {onRefresh && (
            <button className="lifeline-icon-btn" onClick={onRefresh} aria-label="Get new suggestions" title="New suggestions">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5" />
              </svg>
            </button>
          )}
          <button className="lifeline-icon-btn" onClick={onDismiss} aria-label="Dismiss suggestions" title="Dismiss">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
      <ul className="smart-replies">
        {bullets.map((b, i) => (
          <SmartReply key={i} text={b} />
        ))}
      </ul>
    </div>
  );
}
