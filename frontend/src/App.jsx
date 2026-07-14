import { useCallback, useEffect, useRef, useState } from 'react';
import usePlatform from './hooks/usePlatform.js';
import useSilenceDetector from './hooks/useSilenceDetector.js';
import useWebSpeechTranscription from './hooks/useWebSpeechTranscription.js';
import useWhisperTranscription from './hooks/useWhisperTranscription.js';
import LifelineCard from './components/LifelineCard.jsx';
import ReviewDashboard from './components/ReviewDashboard.jsx';
import { postJSON } from './lib/api.js';

const LIFELINE_CONTEXT_LINES = 6;

export default function App() {
  const platform = usePlatform();
  const [stream, setStream] = useState(null);
  const [callActive, setCallActive] = useState(false);
  const [callStartedAt, setCallStartedAt] = useState(null);
  const [micError, setMicError] = useState('');
  const [bullets, setBullets] = useState(null);
  const [showReview, setShowReview] = useState(false);
  const [review, setReview] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState('');

  const webSpeech = useWebSpeechTranscription();
  const whisper = useWhisperTranscription(stream);

  const isDesktop = platform === 'desktop';
  const transcription = isDesktop ? whisper : webSpeech;
  const { transcript } = transcription;
  const transcriptRef = useRef(transcript);
  transcriptRef.current = transcript;
  const lastTranscriptRef = useRef(''); // frozen at end-call for the review
  const transcriptionUnavailable = !isDesktop && !webSpeech.supported;

  const requestLifeline = useCallback(async () => {
    try {
      // Desktop: flush the in-progress audio segment first so the snippet
      // includes what was said in the seconds before the silence.
      if (isDesktop) await whisper.flushNow();
      const lines = transcriptRef.current.slice(-LIFELINE_CONTEXT_LINES);
      if (!lines.length) return;
      const snippet = lines.map((l) => l.text).join('\n');
      const { bullets: result } = await postJSON('/api/lifeline', {
        transcriptSnippet: snippet,
        platform,
      });
      setBullets(result);
    } catch (err) {
      // Never surface lifeline failures mid-call — skip this trigger.
      console.warn('lifeline skipped:', err.message);
    }
  }, [isDesktop, platform, whisper.flushNow]);

  useSilenceDetector({
    stream,
    active: callActive,
    onSilence: requestLifeline,
    onSpeech: () => setBullets(null),
  });

  const startCall = useCallback(async () => {
    setMicError('');
    setReview(null);
    setShowReview(false);
    try {
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      setStream(mic);
      setCallActive(true);
      setCallStartedAt(Date.now());
    } catch {
      setMicError(
        isDesktop
          ? 'Microphone access denied. Check your OS microphone privacy settings and restart HusAI.'
          : 'Microphone access denied. Allow the microphone for this site and try again.'
      );
    }
  }, [isDesktop]);

  // Start the right transcription engine once the mic stream exists.
  useEffect(() => {
    if (!callActive || !stream) return;
    if (isDesktop) whisper.start();
    else webSpeech.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callActive, stream]);

  const fetchReview = useCallback(async (fullTranscript, callDurationSeconds) => {
    setReviewLoading(true);
    setReviewError('');
    try {
      const result = await postJSON('/api/review', {
        fullTranscript,
        callDurationSeconds,
        platform: window.electronAPI?.isDesktop ? 'desktop' : 'web',
      });
      setReview(result);
    } catch (err) {
      setReviewError(
        err.status === 503 && err.message !== `HTTP 503`
          ? err.message
          : 'Your review is taking longer than expected. Please try again in a moment.'
      );
    } finally {
      setReviewLoading(false);
    }
  }, []);

  const endCall = useCallback(async () => {
    setCallActive(false);
    setBullets(null);
    if (isDesktop) await whisper.stop(); // flushes the final audio segment into the transcript
    else webSpeech.stop();
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);

    const fullTranscript = transcriptRef.current.map((l) => l.text).join('\n');
    lastTranscriptRef.current = fullTranscript;
    const durationSeconds = callStartedAt ? Math.round((Date.now() - callStartedAt) / 1000) : 0;

    setShowReview(true);
    if (fullTranscript.trim()) {
      fetchReview(fullTranscript, durationSeconds);
    } else {
      setReviewError('No speech was captured during this call, so there is nothing to review yet.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDesktop, stream, callStartedAt, fetchReview]);

  const retryReview = useCallback(() => {
    const durationSeconds = callStartedAt ? Math.round((Date.now() - callStartedAt) / 1000) : 0;
    if (lastTranscriptRef.current.trim()) fetchReview(lastTranscriptRef.current, durationSeconds);
  }, [callStartedAt, fetchReview]);

  return (
    <div className="app">
      <header>
        <h1>HusAI</h1>
        <span className="tagline">Live call coach for VAs</span>
        <span className={`platform-badge ${platform}`}>{isDesktop ? 'Desktop' : 'Web'}</span>
      </header>

      {transcriptionUnavailable && (
        <div className="banner warning">
          Live transcription requires Chrome or Edge. The Lifeline is disabled in this browser.
        </div>
      )}
      {micError && <div className="banner error">{micError}</div>}

      <div className="controls">
        {!callActive ? (
          <button className="primary" onClick={startCall} disabled={transcriptionUnavailable}>
            Start Call
          </button>
        ) : (
          <button className="danger" onClick={endCall}>
            End Call
          </button>
        )}
        {callActive && <span className="live-dot">● LIVE</span>}
      </div>

      {callActive && (
        <section className="transcript-panel">
          <h3>Live transcript {isDesktop && <small>(updates every ~60s on desktop)</small>}</h3>
          <div className="transcript-lines">
            {transcript.length === 0 && !webSpeech.interim && (
              <p className="muted">Listening… start speaking.</p>
            )}
            {transcript.map((line, i) => (
              <p key={i}>{line.text}</p>
            ))}
            {!isDesktop && webSpeech.interim && <p className="interim">{webSpeech.interim}</p>}
          </div>
        </section>
      )}

      <LifelineCard bullets={bullets} />

      {showReview && (
        <ReviewDashboard
          review={review}
          loading={reviewLoading}
          error={reviewError}
          onRetry={retryReview}
          onClose={() => setShowReview(false)}
        />
      )}
    </div>
  );
}
