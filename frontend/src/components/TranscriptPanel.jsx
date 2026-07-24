import { memo, useEffect, useRef } from 'react';

const fmtTime = (t) => {
  if (!t) return '';
  try {
    return new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
};

/**
 * Speaker-labeled live transcript, rendered as chat bubbles (You / Client) with
 * timestamps — consistent with the practice chat and the coach popup reference.
 * Memoized so interim-text updates don't re-render the whole line list;
 * auto-scrolls to the newest line unless the user has scrolled up to read.
 * `showHeading` off in the compact floating coach.
 */
const TranscriptPanel = memo(function TranscriptPanel({ lines, interim, isDesktop, showHeading = true }) {
  const scrollRef = useRef(null);
  const pinnedToBottomRef = useRef(true);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && pinnedToBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [lines.length, interim]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    pinnedToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  };

  return (
    <section className="transcript-panel">
      {showHeading && (
        <h3>
          Live transcript {isDesktop && <small>(your voice updates in periodic chunks on desktop)</small>}
        </h3>
      )}
      <div className="transcript-lines" ref={scrollRef} onScroll={onScroll}>
        {lines.length === 0 && !interim && <p className="muted t-empty">Listening… start speaking.</p>}
        {lines.map((line, i) => (
          <div key={i} className={`t-msg ${line.speaker}`}>
            <span className="t-msg-head">
              <span className="t-who">{line.speaker === 'va' ? 'You' : 'Client'}</span>
              {line.t && <span className="t-time">{fmtTime(line.t)}</span>}
            </span>
            <span className="t-msg-bubble">{line.text}</span>
          </div>
        ))}
        {interim && (
          <div className="t-msg va interim">
            <span className="t-msg-head">
              <span className="t-who">You</span>
            </span>
            <span className="t-msg-bubble">{interim}</span>
          </div>
        )}
      </div>
    </section>
  );
});

export default TranscriptPanel;
