import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import usePlatform from '../hooks/usePlatform.js';
import useSilenceDetector from '../hooks/useSilenceDetector.js';
import useWebSpeechTranscription from '../hooks/useWebSpeechTranscription.js';
import useSegmentTranscription from '../hooks/useSegmentTranscription.js';
import usePipWindow from '../hooks/usePipWindow.js';
import FloatingCoach from '../components/FloatingCoach.jsx';
import LifelineCard from '../components/LifelineCard.jsx';
import { postJSON, api } from '../lib/api.js';

const LIFELINE_CONTEXT_LINES = 6;

const speakerLabel = (line) => (line.speaker === 'va' ? 'VA' : 'Client');

/** Chronological, speaker-labeled transcript — the shape both AI endpoints consume. */
function toLabeledTranscript(lines) {
  return [...lines]
    .sort((a, b) => a.t - b.t)
    .map((l) => `${speakerLabel(l)}: ${l.text}`)
    .join('\n');
}

/** Average seconds from a client line to the VA's next line — the review's response-speed metric. */
function computeAvgResponseLatency(lines) {
  const sorted = [...lines].sort((a, b) => a.t - b.t);
  const deltas = [];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].speaker === 'va' && sorted[i - 1].speaker === 'client') {
      const delta = (sorted[i].t - sorted[i - 1].t) / 1000;
      if (delta > 0 && delta < 60) deltas.push(delta);
    }
  }
  if (!deltas.length) return undefined;
  return deltas.reduce((s, d) => s + d, 0) / deltas.length;
}

const CallSessionContext = createContext(null);

/**
 * Owns the live-call session (mic + shared tab audio, transcription, Lifeline,
 * PiP, review) at the app-shell level — NOT inside the /call route — so the
 * call keeps running when the VA navigates to Dashboard, Practice, etc. Only
 * the CallView controls are route-gated; the underlying capture never is.
 */
export function CallSessionProvider({ children }) {
  const platform = usePlatform();
  const isDesktop = platform === 'desktop';

  const [micStream, setMicStream] = useState(null);
  const [clientStream, setClientStream] = useState(null);
  // Mirrors the state above for the unmount safety net below — a cleanup
  // closure captured at mount time would only ever see the initial `null`.
  const micStreamRef = useRef(null);
  const clientStreamRef = useRef(null);
  micStreamRef.current = micStream;
  clientStreamRef.current = clientStream;
  const [callActive, setCallActive] = useState(false);
  const [micError, setMicError] = useState('');
  const [clientHint, setClientHint] = useState('');
  const [bullets, setBullets] = useState(null);
  const [showReview, setShowReview] = useState(false);
  const [review, setReview] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [savedMeetingId, setSavedMeetingId] = useState(null);

  // Merged dual-channel transcript. Channel = speaker: the mic is the VA by
  // definition; tab/system audio is the client — deterministic diarization.
  // linesRef is updated synchronously in addLine (not at render time) so lines
  // flushed DURING endCall/requestLifeline are visible before the next render.
  const [lines, setLines] = useState([]);
  const linesRef = useRef([]);
  const addLine = useCallback((line) => {
    if (!line.text) return;
    linesRef.current = [...linesRef.current, line];
    setLines(linesRef.current);
  }, []);
  const resetLines = useCallback(() => {
    linesRef.current = [];
    setLines([]);
  }, []);
  const addVaLine = useCallback(({ text, t }) => addLine({ speaker: 'va', text, t }), [addLine]);

  const callStartedAtRef = useRef(null);
  const durationSecondsRef = useRef(0);
  const clientSpeakingRef = useRef(false);

  // VA transcription: streaming Web Speech on web; chunked Whisper on desktop.
  const webSpeech = useWebSpeechTranscription({ onLine: addVaLine });
  // 30s (not 60): Whisper mangles sentences that span a chunk boundary, so
  // shorter segments trade a few extra requests for cleaner cuts.
  const desktopMic = useSegmentTranscription(micStream, { speaker: 'va', onLine: addLine, chunkSeconds: 30 });
  // Client transcription: VAD-gated 10s Whisper chunks from the shared tab audio.
  const clientEars = useSegmentTranscription(clientStream, { speaker: 'client', onLine: addLine, chunkSeconds: 10 });

  // Always-on-top floating coach (Document PiP; Chrome/Edge). Desktop floats
  // the whole Electron window instead (see the callActive effect below).
  const pip = usePipWindow();

  const transcriptionUnavailable = !isDesktop && !webSpeech.supported;

  const requestLifeline = useCallback(async () => {
    try {
      // Flush in-progress Whisper segments first so the snippet includes what
      // was said in the seconds before the pause — especially the client's
      // last sentence, which is usually what the VA is stuck on.
      if (isDesktop) await desktopMic.flushNow();
      await clientEars.flushNow();
      const recent = [...linesRef.current].sort((a, b) => a.t - b.t).slice(-LIFELINE_CONTEXT_LINES);
      if (!recent.length) return;
      const snippet = recent.map((l) => `${speakerLabel(l)}: ${l.text}`).join('\n');
      const { bullets: result } = await postJSON('/api/lifeline', { transcriptSnippet: snippet, platform });
      setBullets(result);
    } catch (err) {
      // Never surface lifeline failures mid-call — skip this trigger.
      console.warn('lifeline skipped:', err.message);
    }
  }, [isDesktop, platform, desktopMic.flushNow, clientEars.flushNow]);

  // Lifeline trigger: VA silent ≥4s — but client speech resets the clock
  // (suppressRef), so it fires when it's genuinely the VA's turn, never while
  // the client is mid-sentence. Suggestions PERSIST while the VA responds
  // (they're reference material, not a popup): only a newer Lifeline or the
  // ✕ button removes them.
  useSilenceDetector({
    stream: micStream,
    active: callActive,
    onSilence: requestLifeline,
    suppressRef: clientSpeakingRef,
  });
  // Bare speaking-probe on the client channel feeding suppressRef.
  useSilenceDetector({
    stream: clientStream,
    active: callActive && Boolean(clientStream),
    speakingRef: clientSpeakingRef,
  });

  const startCall = useCallback(async () => {
    setMicError('');
    setClientHint('');
    setReview(null);
    setShowReview(false);
    setSavedMeetingId(null);
    resetLines();
    // Open the floating coach FIRST: requestWindow needs the click's user
    // activation, which the getUserMedia await below would outlive.
    if (!isDesktop && pip.supported) {
      try {
        await pip.open();
      } catch {
        /* PiP declined/unavailable — the inline call view still shows everything */
      }
    }
    try {
      // Echo cancellation matters most: without it the client's voice (playing
      // through speakers) bleeds into the mic and corrupts the VA channel.
      const mic = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      setMicStream(mic);
      setCallActive(true);
      callStartedAtRef.current = Date.now();
    } catch {
      pip.close();
      setMicError(
        isDesktop
          ? 'Microphone access denied. Check your OS microphone privacy settings and restart HusAI.'
          : 'Microphone access denied. Allow the microphone for this site and try again.'
      );
    }
  }, [isDesktop, resetLines, pip.supported, pip.open, pip.close]);

  // Start the right VA transcription engine once the mic stream exists.
  useEffect(() => {
    if (!callActive || !micStream) return;
    if (isDesktop) desktopMic.start();
    else webSpeech.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callActive, micStream]);

  // Start client-channel transcription whenever a shared stream appears.
  useEffect(() => {
    if (!callActive || !clientStream) return;
    clientEars.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callActive, clientStream]);

  // Warn on an actual tab close/refresh during a live call — SPA navigation
  // (Dashboard, Practice, etc.) is fine and must NOT trigger this; the
  // provider living outside the /call route is what makes that true.
  useEffect(() => {
    if (!callActive) return undefined;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [callActive]);

  // Safety net: if the provider itself unmounts (e.g. the user logs out
  // mid-call), release the mic and shared-tab-audio tracks anyway. Without
  // this, an orphaned MediaStream keeps Chrome's "sharing this tab" indicator
  // lit indefinitely with no way for the user to stop it from the UI.
  useEffect(
    () => () => {
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      clientStreamRef.current?.getTracks().forEach((t) => t.stop());
    },
    []
  );

  // Desktop: float the whole Electron window above other apps during the call.
  useEffect(() => {
    if (!isDesktop) return undefined;
    window.electronAPI?.setFloat?.(callActive);
    return () => window.electronAPI?.setFloat?.(false);
  }, [isDesktop, callActive]);

  const stopClientShare = useCallback(async () => {
    await clientEars.stop(); // flush the tail segment into the transcript
    setClientStream((current) => {
      current?.getTracks().forEach((t) => t.stop());
      return null;
    });
  }, [clientEars.stop]);

  const startClientShare = useCallback(async () => {
    setClientHint('');
    let display;
    try {
      display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    } catch {
      return; // user cancelled the picker — not an error
    }
    if (!display.getAudioTracks().length) {
      display.getTracks().forEach((t) => t.stop());
      setClientHint('No tab audio was shared. Pick your meeting tab and tick “Also share tab audio”, then try again.');
      return;
    }
    // Browser "Stop sharing" bar (or the tab closing) ends the track.
    display.getAudioTracks()[0].addEventListener('ended', () => stopClientShare());
    setClientStream(display);
  }, [stopClientShare]);

  /** Persist the call as a Meeting; the review comes back in the same response. */
  const saveMeeting = useCallback(async (transcript, durationSeconds, avgResponseLatencySeconds) => {
    setReviewLoading(true);
    setReviewError('');
    try {
      const result = await api.post('/api/meetings', {
        transcript,
        durationSeconds,
        platform: window.electronAPI?.isDesktop ? 'desktop' : 'web',
        startedAt: callStartedAtRef.current || Date.now(),
        avgResponseLatencySeconds,
      });
      setSavedMeetingId(result.meeting.id);
      if (result.review) {
        setReview(result.review);
      } else {
        // Meeting saved; only the AI review failed (e.g. provider hiccup).
        setReviewError('Your call is saved. The review is taking longer than expected — try again in a moment.');
      }
    } catch (err) {
      setReviewError(err.message || 'Could not save this call. Please try again.');
    } finally {
      setReviewLoading(false);
    }
  }, []);

  const retryReview = useCallback(async () => {
    if (!savedMeetingId) return;
    setReviewLoading(true);
    setReviewError('');
    try {
      const result = await api.post(`/api/meetings/${savedMeetingId}/review`, {});
      setReview(result.review);
    } catch (err) {
      setReviewError(err.message || 'Still not ready — please try again in a moment.');
    } finally {
      setReviewLoading(false);
    }
  }, [savedMeetingId]);

  const endCall = useCallback(async () => {
    setCallActive(false);
    setBullets(null);
    pip.close(); // review happens in the main window

    if (isDesktop) await desktopMic.stop(); // flushes the final audio segment into the transcript
    else webSpeech.stop();
    if (clientStream) await stopClientShare();
    setMicStream((current) => {
      current?.getTracks().forEach((t) => t.stop());
      return null;
    });

    const fullTranscript = toLabeledTranscript(linesRef.current);
    durationSecondsRef.current = callStartedAtRef.current
      ? Math.round((Date.now() - callStartedAtRef.current) / 1000)
      : 0;

    setShowReview(true);
    if (fullTranscript.trim()) {
      saveMeeting(fullTranscript, durationSecondsRef.current, computeAvgResponseLatency(linesRef.current));
    } else {
      setReviewError('No speech was captured during this call, so there is nothing to review yet.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDesktop, clientStream, stopClientShare, saveMeeting]);

  const value = {
    callActive,
    isDesktop,
    micError,
    transcriptionUnavailable,
    lines,
    interim: !isDesktop ? webSpeech.interim : '',
    clientShare: {
      available: !isDesktop && callActive,
      active: Boolean(clientStream),
      hint: clientHint,
      onStart: startClientShare,
      onStop: stopClientShare,
    },
    floatingCoach: {
      supported: !isDesktop && pip.supported,
      active: Boolean(pip.pipWindow),
      onPopOut: pip.open,
      onBringBack: pip.close,
    },
    startCall,
    endCall,
    // Start timestamp (ms) of the current call, for the Sidebar's live-call
    // status timer — read-only, the actual timing logic is unchanged.
    callStartedAt: callStartedAtRef.current,
    // Review state/actions are consumed by CallPage itself, not rendered here:
    // ReviewDashboard is an inline panel (not a fixed overlay), so it only
    // makes sense stacked under CallView on the /call route.
    showReview,
    review,
    reviewLoading,
    reviewError,
    savedMeetingId,
    retryReview,
    closeReview: () => setShowReview(false),
  };

  return (
    <CallSessionContext.Provider value={value}>
      {children}

      {/* Overlays rendered at the shell level (not the /call route) so they
          keep working — Lifeline suggestions, the floating coach, and the
          post-call review — no matter which in-app page the VA is on. */}
      <LifelineCard
        bullets={bullets}
        onDismiss={() => setBullets(null)}
        onRefresh={requestLifeline}
        micStream={callActive ? micStream : undefined}
        active={callActive}
      />

      {pip.pipWindow &&
        createPortal(
          <FloatingCoach
            lines={lines}
            interim={!isDesktop ? webSpeech.interim : ''}
            isDesktop={isDesktop}
            bullets={bullets}
            onDismissBullets={() => setBullets(null)}
            onRefreshBullets={requestLifeline}
            micStream={micStream}
            clientAudioActive={Boolean(clientStream)}
          />,
          pip.pipWindow.document.body
        )}
    </CallSessionContext.Provider>
  );
}

export function useCallSession() {
  const ctx = useContext(CallSessionContext);
  if (!ctx) throw new Error('useCallSession must be used within CallSessionProvider');
  return ctx;
}
