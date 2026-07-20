import TranscriptPanel from './TranscriptPanel.jsx';
import LifelineCard from './LifelineCard.jsx';

/**
 * Compact coach UI portaled into the Document PiP window: live status,
 * Lifeline suggestions (docked, not floating — the whole window floats),
 * and the running transcript.
 */
export default function FloatingCoach({ lines, interim, isDesktop, bullets, onDismissBullets, clientAudioActive }) {
  return (
    <div className="floating-coach">
      <div className="coach-status">
        <span className="live-dot">● LIVE</span>
        <span>HusAI Coach</span>
        <span className={`chip ${clientAudioActive ? 'on' : ''}`}>
          {clientAudioActive ? '🔊 client audio on' : 'mic only'}
        </span>
      </div>
      <LifelineCard bullets={bullets} onDismiss={onDismissBullets} docked />
      <TranscriptPanel lines={lines} interim={interim} isDesktop={isDesktop} />
    </div>
  );
}
