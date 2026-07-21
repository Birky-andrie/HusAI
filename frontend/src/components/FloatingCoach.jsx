import TranscriptPanel from './TranscriptPanel.jsx';
import LifelineCard from './LifelineCard.jsx';
import Logo from './Logo.jsx';
import MicVisualizer from './ui/MicVisualizer.jsx';

/**
 * Compact coach UI portaled into the Document PiP window — the whole window
 * floats. Redesigned to the reference: a titled header with live status and a
 * microphone visualizer, the persistent Smart Replies, and the running
 * transcript. Suggestions never clear on speech (see the silence detector).
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

      <div className="coach-substatus">
        <span className={`chip ${clientAudioActive ? 'on' : ''}`}>
          {clientAudioActive ? '🔊 Client audio on' : 'Mic only'}
        </span>
      </div>

      <LifelineCard bullets={bullets} onDismiss={onDismissBullets} onRefresh={onRefreshBullets} docked />
      <TranscriptPanel lines={lines} interim={interim} isDesktop={isDesktop} />
    </div>
  );
}
