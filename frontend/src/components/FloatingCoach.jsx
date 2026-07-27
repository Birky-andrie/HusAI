import { useEffect, useState } from 'react';
import TranscriptPanel from './TranscriptPanel.jsx';
import LifelineCard from './LifelineCard.jsx';
import Logo from './Logo.jsx';
import MicVisualizer from './ui/MicVisualizer.jsx';

const EyeIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const BulbIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10c1 1 1 2 1 3h6c0-1 0-2 1-3a6 6 0 0 0-4-10Z" />
  </svg>
);

function fmtElapsed(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = String(Math.floor(total / 60)).padStart(2, '0');
  const sec = String(total % 60).padStart(2, '0');
  return `${m}:${sec}`;
}

/**
 * The floating "HusAI Live Coach" window (portaled into the Document PiP window,
 * so the whole thing floats — including outside the browser, above Zoom/Meet).
 * That's a real OS-level window with native dragging, so there's no manual
 * drag state here — Chrome already handles repositioning. Header: live badge +
 * elapsed timer + a gradient, audio-reactive mic waveform (real levels, not
 * decorative). Below: the running transcript, then the persistent Smart
 * Replies — suggestions never clear on speech (see the silence detector) —
 * with a footer to toggle each section in the compact window.
 */
export default function FloatingCoach({
  lines,
  interim,
  isDesktop,
  bullets,
  onDismissBullets,
  onRefreshBullets,
  micStream,
  clientAudioActive,
  callStartedAt,
  conversationMode,
  onToggleConversationMode,
}) {
  const [showTranscript, setShowTranscript] = useState(true);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [, forceTick] = useState(0);

  useEffect(() => {
    if (!callStartedAt) return undefined;
    const id = setInterval(() => forceTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [callStartedAt]);

  return (
    <div className="floating-coach">
      <header className="coach-header">
        <span className="coach-title">
          <span className="coach-dot" aria-hidden="true" />
          <Logo size={18} withWordmark={false} />
          <span>HusAI Live Coach</span>
        </span>
        {callStartedAt && <span className="coach-time">{fmtElapsed(Date.now() - callStartedAt)}</span>}
        <MicVisualizer stream={micStream} variant="hero" bars={5} label="Microphone active" />
      </header>

      <div className="coach-status">
        <span className="coach-status-live" aria-hidden="true" />
        {clientAudioActive ? 'Coaching both sides of the call' : 'Listening to your microphone'}
      </div>

      {/* Reachable from the floating window too — the VA is usually here, not
          in the tab, while the client side is talking. */}
      {clientAudioActive && onToggleConversationMode && (
        <button
          className={`convo-toggle compact${conversationMode ? ' on' : ''}`}
          onClick={onToggleConversationMode}
          aria-pressed={Boolean(conversationMode)}
          title="Suggest ways to join the client-side discussion"
        >
          <span className="convo-dot" aria-hidden="true" />
          Conversation Mode {conversationMode ? 'on' : 'off'}
        </button>
      )}

      {showTranscript && (
        <TranscriptPanel lines={lines} interim={interim} isDesktop={isDesktop} showHeading={false} />
      )}
      {showSuggestions && (
        <LifelineCard bullets={bullets} onDismiss={onDismissBullets} onRefresh={onRefreshBullets} docked />
      )}

      <footer className="coach-footer">
        <button
          className={`coach-toggle${showTranscript ? ' on' : ''}`}
          onClick={() => setShowTranscript((v) => !v)}
          aria-pressed={showTranscript}
        >
          <EyeIcon /> Transcript
        </button>
        <button
          className={`coach-toggle${showSuggestions ? ' on' : ''}`}
          onClick={() => setShowSuggestions((v) => !v)}
          aria-pressed={showSuggestions}
        >
          <BulbIcon /> Suggestions
        </button>
        <span className="coach-hint">Stays while you talk</span>
      </footer>
    </div>
  );
}
