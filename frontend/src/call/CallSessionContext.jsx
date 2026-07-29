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
// Banter mode leans on more context: the client side is mid-discussion, so the
// last couple of lines rarely carry the whole thread.
const BANTER_CONTEXT_LINES = 8;

// How often banter mode re-checks whether it should refresh suggestions. It
// only actually fires when the client side is talking AND new transcript has
// landed, so this is a poll interval, not a request rate — see the effect below.
const BANTER_TICK_MS = 4000;

// Persisted so a VA who works this way doesn't re-enable it every call.
const BANTER_PREF_KEY = 'husai.conversationMode';

/** Longest gap still counted as "responding". Was 60s — see computeAvgResponseLatency. */
const MAX_RESPONSE_LATENCY_S = 20;

// --- Mic-bleed detection tuning -------------------------------------------
// A VA "line" is treated as echo ONLY if the client channel was audibly live at
// the moment it was captured AND its wording overlaps what they just said.
// Either signal alone produces false positives (see the guard for why).
const BLEED_SPEAKING_WINDOW_MS = 1500; // how close in time counts as "at the same moment"
const BLEED_LOOKBACK_MS = 20_000; // how far back to compare client wording
const BLEED_OVERLAP_RATIO = 0.75; // share of the VA line's words also in client speech
const BLEED_MIN_WORDS = 4; // shorter utterances are backchannel ("yes", "okay"), never suppressed

// "Client side" (not "Client"): the shared tab/system audio is ONE channel with
// no speaker separation, so these lines may be several participants. The label
// keeps the AI prompts honest about that. Parsers accept the legacy "Client:"
// prefix too — transcripts recorded before this change are stored that way.
const speakerLabel = (line) => (line.speaker === 'va' ? 'VA' : 'Client side');

/** Chronological, speaker-labeled transcript — the shape both AI endpoints consume. */
function toLabeledTranscript(lines) {
  return [...lines]
    .sort((a, b) => a.t - b.t)
    .map((l) => `${speakerLabel(l)}: ${l.text}`)
    .join('\n');
}

/**
 * Average seconds from a client line to the VA's next line — the review's
 * response-speed metric.
 *
 * Two exclusions keep this from punishing correct behaviour. When several
 * people on the client side talk amongst themselves, staying quiet is the
 * professional move, but naively every second of their exchange counts as the
 * VA "being slow to respond". So a gap is only measured when:
 *
 *  1. Exactly ONE client-side line precedes the VA's reply. Consecutive
 *     client lines mean an extended discussion on their end, not a question
 *     left hanging.
 *  2. That client line was not captured while Conversation Mode was on — the
 *     VA explicitly told us that stretch was banter, not a prompt to answer.
 */
function computeAvgResponseLatency(lines) {
  const sorted = [...lines].sort((a, b) => a.t - b.t);
  const deltas = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    if (sorted[i].speaker !== 'va' || prev.speaker !== 'client') continue;
    if (prev.banter) continue; // (2) explicit banter stretch
    if (sorted[i - 2]?.speaker === 'client') continue; // (1) multi-turn client exchange

    const delta = (sorted[i].t - prev.t) / 1000;
    if (delta > 0 && delta < MAX_RESPONSE_LATENCY_S) deltas.push(delta);
  }
  if (!deltas.length) return undefined;
  return deltas.reduce((s, d) => s + d, 0) / deltas.length;
}

/** Words only, lowercased — punctuation and casing must not affect overlap. */
const wordsOf = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);

/** Share of `candidate`'s words that also appear in `corpus`. */
function overlapRatio(candidate, corpus) {
  const words = wordsOf(candidate);
  if (!words.length) return 0;
  const bag = new Set(wordsOf(corpus));
  return words.filter((w) => bag.has(w)).length / words.length;
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
  // True only while startCall() is in flight (PiP + mic-permission prompt can
  // take a real moment) — lets the UI show a busy state instead of looking
  // like the click didn't register.
  const [starting, setStarting] = useState(false);
  const [micError, setMicError] = useState('');
  const [clientHint, setClientHint] = useState('');
  const [bullets, setBullets] = useState(null);
  const [showReview, setShowReview] = useState(false);
  const [review, setReview] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [savedMeetingId, setSavedMeetingId] = useState(null);

  // Conversation Mode: keep coaching the VA on how to JOIN an ongoing
  // client-side discussion, instead of only filling silences. Opt-in because it
  // asks the model for suggestions far more often than turn-based coaching.
  const [conversationMode, setConversationMode] = useState(
    () => localStorage.getItem(BANTER_PREF_KEY) === '1'
  );
  const conversationModeRef = useRef(conversationMode);
  conversationModeRef.current = conversationMode;
  const toggleConversationMode = useCallback(() => {
    setConversationMode((on) => {
      try {
        localStorage.setItem(BANTER_PREF_KEY, on ? '0' : '1');
      } catch { /* private mode — preference just won't persist */ }
      return !on;
    });
  }, []);

  const clientSpeakingRef = useRef(false);
  // Rolling log of when the client channel was audibly live. Sampled on a timer
  // rather than read at delivery time because desktop Whisper lines arrive
  // seconds after the audio they describe — the log lets us ask "was the client
  // talking *when this was recorded*" on both platforms.
  const clientSpeechLogRef = useRef([]);
  const clientWasSpeakingAt = useCallback(
    (t) => clientSpeechLogRef.current.some((ts) => Math.abs(ts - t) <= BLEED_SPEAKING_WINDOW_MS),
    []
  );

  // Merged dual-channel transcript. Channel = speaker: the mic is the VA by
  // definition; tab/system audio is the client — deterministic diarization.
  // linesRef is updated synchronously in addLine (not at render time) so lines
  // flushed DURING endCall/requestLifeline are visible before the next render.
  const [lines, setLines] = useState([]);
  const linesRef = useRef([]);

  /**
   * Echo guard. On speakers (not headphones) the client's voice plays out loud
   * and can leak into the VA's mic, landing in the transcript as words the VA
   * never said — which then pollutes their filler/apology metrics and the
   * coaching review.
   *
   * Suppression requires BOTH signals, deliberately:
   *  - the client channel was live at the moment this was captured, and
   *  - the wording substantially repeats what they just said.
   *
   * Text similarity alone would misfire on the confirm-and-summarise technique
   * the Lifeline actively coaches ("To summarize: I will send the report…"),
   * which legitimately echoes the client's words — but happens AFTER they stop
   * talking, so the timing signal clears it. Short utterances are never
   * suppressed: "yes"/"right" while listening is real backchannel.
   */
  const looksLikeMicBleed = useCallback(
    (text, t) => {
      if (wordsOf(text).length < BLEED_MIN_WORDS) return false;
      if (!clientWasSpeakingAt(t)) return false;
      const recentClientText = linesRef.current
        .filter((l) => l.speaker === 'client' && t - l.t <= BLEED_LOOKBACK_MS && l.t <= t + BLEED_SPEAKING_WINDOW_MS)
        .map((l) => l.text)
        .join(' ');
      if (!recentClientText) return false;
      return overlapRatio(text, recentClientText) >= BLEED_OVERLAP_RATIO;
    },
    [clientWasSpeakingAt]
  );

  const addLine = useCallback(
    (line) => {
      if (!line.text) return;
      if (line.speaker === 'va' && looksLikeMicBleed(line.text, line.t)) {
        // Dropping is lossless: an echo means the client channel already
        // captured the real utterance, so the words are still in the transcript
        // under the correct speaker.
        console.warn('dropped suspected mic bleed from VA channel:', line.text);
        return;
      }
      // Tag banter so the post-call latency metric can exclude these stretches.
      linesRef.current = [...linesRef.current, { ...line, banter: conversationModeRef.current || undefined }];
      setLines(linesRef.current);
    },
    [looksLikeMicBleed]
  );

  const resetLines = useCallback(() => {
    linesRef.current = [];
    setLines([]);
  }, []);
  const addVaLine = useCallback(({ text, t }) => addLine({ speaker: 'va', text, t }), [addLine]);

  const callStartedAtRef = useRef(null);
  const durationSecondsRef = useRef(0);

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

  const requestLifeline = useCallback(
    async (mode = 'turn') => {
      const banter = mode === 'banter';
      try {
        // Turn mode flushes in-progress Whisper segments first so the snippet
        // includes what was said in the seconds before the pause — especially
        // the client's last sentence, which is usually what the VA is stuck on.
        // Banter mode deliberately does NOT flush: the client channel is
        // already producing a line every ~10s while they talk, and forcing
        // extra segment rotations would burn Whisper quota for a few seconds
        // of freshness that a running discussion doesn't need.
        if (!banter) {
          if (isDesktop) await desktopMic.flushNow();
          await clientEars.flushNow();
        }
        const recent = [...linesRef.current]
          .sort((a, b) => a.t - b.t)
          .slice(-(banter ? BANTER_CONTEXT_LINES : LIFELINE_CONTEXT_LINES));
        if (!recent.length) return;
        const snippet = recent.map((l) => `${speakerLabel(l)}: ${l.text}`).join('\n');
        const { bullets: result } = await postJSON('/api/lifeline', { transcriptSnippet: snippet, platform, mode });
        setBullets(result);
      } catch (err) {
        // Never surface lifeline failures mid-call — skip this trigger.
        console.warn('lifeline skipped:', err.message);
      }
    },
    [isDesktop, platform, desktopMic.flushNow, clientEars.flushNow]
  );

  /**
   * Manual "new suggestions" button. Must NOT be wired directly to
   * requestLifeline — it's an onClick handler, so React would pass the click
   * event as the `mode` argument and serialize it into the request body.
   * Reads the mode from a ref so the identity stays stable across toggles.
   */
  const refreshLifeline = useCallback(
    () => requestLifeline(conversationModeRef.current ? 'banter' : 'turn'),
    [requestLifeline]
  );

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

  // Sample the client-speaking probe into a rolling log, so the mic-bleed guard
  // can ask "was the client audible at time T" even for desktop lines that
  // arrive well after the audio they transcribe.
  useEffect(() => {
    if (!callActive || !clientStream) return undefined;
    const id = setInterval(() => {
      if (!clientSpeakingRef.current) return;
      const log = clientSpeechLogRef.current;
      log.push(Date.now());
      // Keep roughly the last 10 minutes; older entries can't match any line
      // still inside BLEED_LOOKBACK_MS.
      if (log.length > 3000) log.splice(0, log.length - 3000);
    }, 200);
    return () => clearInterval(id);
  }, [callActive, clientStream]);

  /**
   * Conversation Mode trigger. The turn-based Lifeline above stays exactly as
   * it was (it fires on VA silence and is suppressed while the client talks);
   * this is the inverse case — the client side is mid-discussion and the VA
   * wants a way in.
   *
   * Gated on NEW transcript rather than the clock, so a long stretch of client
   * chatter costs one request per new client line (~1 per 10s chunk) instead of
   * one per tick, and suggestions never regenerate from unchanged context.
   */
  const lastBanterLineCountRef = useRef(0);
  useEffect(() => {
    if (!callActive || !conversationMode || !clientStream) return undefined;
    lastBanterLineCountRef.current = linesRef.current.length;
    const id = setInterval(() => {
      if (!clientSpeakingRef.current) return; // only while they're actually talking
      if (linesRef.current.length === lastBanterLineCountRef.current) return; // nothing new to react to
      lastBanterLineCountRef.current = linesRef.current.length;
      requestLifeline('banter');
    }, BANTER_TICK_MS);
    return () => clearInterval(id);
  }, [callActive, conversationMode, clientStream, requestLifeline]);

  const startCall = useCallback(async () => {
    setStarting(true);
    try {
      setMicError('');
      setClientHint('');
      setReview(null);
      setShowReview(false);
      setSavedMeetingId(null);
      resetLines();
      clientSpeechLogRef.current = []; // stale timestamps would mis-trigger the bleed guard
      lastBanterLineCountRef.current = 0;
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
    } finally {
      setStarting(false);
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
    starting,
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
    // Conversation Mode: keep suggesting ways to JOIN an ongoing client-side
    // discussion, instead of only coaching the VA's own silences.
    conversationMode,
    toggleConversationMode,
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
        onRefresh={refreshLifeline}
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
            onRefreshBullets={refreshLifeline}
            micStream={micStream}
            callStartedAt={callActive ? callStartedAtRef.current : null}
            clientAudioActive={Boolean(clientStream)}
            conversationMode={conversationMode}
            onToggleConversationMode={toggleConversationMode}
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
