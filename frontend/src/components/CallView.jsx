import TranscriptPanel from './TranscriptPanel.jsx';

export default function CallView({
  callActive,
  isDesktop,
  micError,
  transcriptionUnavailable,
  lines,
  interim,
  clientShare, // { available, active, hint, onStart, onStop }
  floatingCoach, // { supported, active, onPopOut, onBringBack }
  conversationMode,
  onToggleConversationMode,
  onStartCall,
  onEndCall,
  onBack,
}) {
  return (
    <div className="call-view">
      {transcriptionUnavailable && (
        <div className="banner warning">
          Live transcription requires Chrome or Edge. The Lifeline is disabled in this browser.
        </div>
      )}
      {micError && <div className="banner error">{micError}</div>}

      <div className="controls">
        {!callActive ? (
          <>
            <button className="secondary" onClick={onBack}>
              ← Back
            </button>
            <button className="primary" onClick={onStartCall} disabled={transcriptionUnavailable}>
              Start Call
            </button>
          </>
        ) : (
          <button className="danger" onClick={onEndCall}>
            End Call
          </button>
        )}
        {callActive && <span className="live-dot">● LIVE</span>}
        {callActive &&
          floatingCoach.supported &&
          (floatingCoach.active ? (
            <button className="secondary" onClick={floatingCoach.onBringBack}>
              Bring coach back
            </button>
          ) : (
            <button className="secondary" onClick={floatingCoach.onPopOut}>
              ⧉ Float the coach
            </button>
          ))}
      </div>

      {callActive && floatingCoach.active && (
        <div className="banner info">
          The coach is floating above your other windows — switch to your meeting; the Lifeline follows you.
        </div>
      )}

      {callActive && (
        <div className="capture-chips">
          <span className="chip on">🎙 Your mic</span>
          {clientShare.available &&
            (clientShare.active ? (
              <span className="chip on">
                🔊 Client audio
                <button className="chip-action" onClick={clientShare.onStop}>
                  stop
                </button>
              </span>
            ) : (
              <button className="chip off chip-button" onClick={clientShare.onStart}>
                + Share client audio
              </button>
            ))}
        </div>
      )}
      {callActive && clientShare.hint && <div className="banner warning">{clientShare.hint}</div>}

      {/* Only meaningful once client audio is shared — there is no discussion to
          join without it. */}
      {callActive && clientShare.active && (
        <div className="convo-mode">
          <button
            className={`convo-toggle${conversationMode ? ' on' : ''}`}
            onClick={onToggleConversationMode}
            aria-pressed={Boolean(conversationMode)}
          >
            <span className="convo-dot" aria-hidden="true" />
            Conversation Mode {conversationMode ? 'on' : 'off'}
          </button>
          <span className="convo-hint">
            {conversationMode
              ? 'Suggesting ways to join in while the client side talks.'
              : 'Turn on to get suggestions for joining the client-side discussion.'}
          </span>
        </div>
      )}

      {callActive && clientShare.active && (
        <p className="capture-note">
          Shared audio is captured as one channel, so everyone on the client&apos;s end is transcribed
          together as “Client side” — HusAI can&apos;t tell individual participants apart yet.
        </p>
      )}

      {callActive && <TranscriptPanel lines={lines} interim={interim} isDesktop={isDesktop} />}

      {!callActive && (
        <div className="call-setup">
          <h3>Before you start</h3>
          <ol>
            <li>Use Chrome or Edge, and allow microphone access when asked.</li>
            {!isDesktop && (
              <li>
                Once the call is live, click <strong>Share client audio</strong>, pick your meeting tab, and tick{' '}
                <em>“Also share tab audio”</em> — that&apos;s how HusAI hears your client.
              </li>
            )}
            <li>Pause for a few seconds whenever you&apos;re stuck — the Lifeline will appear with suggestions.</li>
          </ol>
        </div>
      )}
    </div>
  );
}
