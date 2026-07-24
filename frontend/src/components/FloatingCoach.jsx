import { useState } from 'react';
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

/**
 * The floating "HusAI Live Coach" window (portaled into the Document PiP window,
 * so the whole thing floats). Layout follows the reference: a titled header with
 * live status + mic visualizer, a status strip, the running transcript (chat
 * bubbles), the persistent Smart Replies, and a footer to toggle each section in
 * the compact window. Suggestions never clear on speech (see the silence
 * detector) — the footer toggle only hides/shows the panel.
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
}) {
  const [showTranscript, setShowTranscript] = useState(true);
  const [showSuggestions, setShowSuggestions] = useState(true);

  return (
    <div className="floating-coach">
      <header className="coach-header">
        <span className="coach-title">
          <span className="coach-dot" aria-hidden="true" />
          <Logo size={20} withWordmark={false} />
          <span>HusAI Live Coach</span>
        </span>
        <MicVisualizer stream={micStream} bars={5} label="Microphone active" />
      </header>

      <div className="coach-status">
        <span className="coach-status-live" aria-hidden="true" />
        {clientAudioActive ? 'Coaching both sides of the call' : 'Listening to your microphone'}
      </div>

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
