import { memo, useEffect, useRef } from 'react';

/**
 * Speaker-labeled live transcript. Memoized so interim-text updates in the
 * parent don't re-render the (potentially long) line list; auto-scrolls to the
 * newest line unless the user has scrolled up to read something.
 */
const TranscriptPanel = memo(function TranscriptPanel({ lines, interim, isDesktop }) {
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
      <h3>
        Live transcript{' '}
        {isDesktop && <small>(your voice updates in periodic chunks on desktop)</small>}
      </h3>
      <div className="transcript-lines" ref={scrollRef} onScroll={onScroll}>
        {lines.length === 0 && !interim && <p className="muted">Listening… start speaking.</p>}
        {lines.map((line, i) => (
          <p key={i} className={`line ${line.speaker}`}>
            <span className="speaker-tag">{line.speaker === 'va' ? 'You' : 'Client'}</span>
            {line.text}
          </p>
        ))}
        {interim && (
          <p className="line va interim">
            <span className="speaker-tag">You</span>
            {interim}
          </p>
        )}
      </div>
    </section>
  );
});

export default TranscriptPanel;
