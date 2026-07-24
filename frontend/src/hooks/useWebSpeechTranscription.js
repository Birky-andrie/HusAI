import { useCallback, useEffect, useRef, useState } from 'react';

const SpeechRecognitionImpl =
  typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : undefined;

export const webSpeechSupported = Boolean(SpeechRecognitionImpl);

const WATCHDOG_INTERVAL_MS = 5000;

/**
 * Web build only. Chrome's SpeechRecognition silently stops (onend fires) after
 * long pauses or ~60s in some builds, so we auto-restart until the user
 * explicitly stops — transcription must never die mid-call.
 *
 * Two layers of self-healing:
 * 1. onend → delayed respawn with retries (Chrome needs a beat to release the
 *    recognition service; a synchronous restart throws InvalidStateError).
 * 2. A watchdog interval: if we should be running but recognition is not
 *    listening (any failure path we did not anticipate), respawn.
 *
 * Final results are delivered through `onLine({ text, t })` — the caller owns
 * the merged multi-speaker transcript; this hook only owns the interim text.
 */
export default function useWebSpeechTranscription({ onLine } = {}) {
  const [interim, setInterim] = useState('');
  const [isListening, setIsListening] = useState(false);
  const onLineRef = useRef(onLine);
  onLineRef.current = onLine;
  const recognitionRef = useRef(null);
  const shouldRunRef = useRef(false);
  const listeningRef = useRef(false);
  const watchdogRef = useRef(null);

  const start = useCallback(() => {
    if (!SpeechRecognitionImpl || shouldRunRef.current) return;
    shouldRunRef.current = true;
    setInterim('');

    const spawn = () => {
      const rec = new SpeechRecognitionImpl();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-PH'; // Philippine English — tuned for Filipino-accented speech and tolerates Tagalog code-switching better than en-US

      rec.onstart = () => {
        listeningRef.current = true;
        setIsListening(true);
      };

      rec.onresult = (event) => {
        let interimText = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            const text = result[0].transcript.trim();
            if (text) onLineRef.current?.({ text, t: Date.now() });
          } else {
            interimText += result[0].transcript;
          }
        }
        setInterim(interimText);
      };

      rec.onerror = (event) => {
        // Permission errors are fatal; anything else falls through to onend, which restarts.
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          shouldRunRef.current = false;
        }
      };

      rec.onend = () => {
        listeningRef.current = false;
        setInterim('');
        if (!shouldRunRef.current) {
          setIsListening(false);
          return;
        }
        // Chrome's recognition service needs a beat to release after `end`
        // fires; restarting synchronously here throws InvalidStateError and
        // (without this retry) kills transcription for the rest of the call.
        const attemptRestart = (retriesLeft) => {
          if (!shouldRunRef.current || listeningRef.current) return;
          try {
            spawn();
          } catch {
            if (retriesLeft > 0) {
              setTimeout(() => attemptRestart(retriesLeft - 1), 300);
            } else {
              setIsListening(false); // the watchdog gets the next attempt
            }
          }
        };
        setTimeout(() => attemptRestart(3), 250);
      };

      recognitionRef.current = rec;
      rec.start();
    };

    spawn();

    // Last line of defense: whatever stopped recognition, bring it back.
    clearInterval(watchdogRef.current);
    watchdogRef.current = setInterval(() => {
      if (!shouldRunRef.current || listeningRef.current) return;
      try {
        spawn();
      } catch {
        /* still winding down — next watchdog tick retries */
      }
    }, WATCHDOG_INTERVAL_MS);
  }, []);

  const stop = useCallback(() => {
    shouldRunRef.current = false;
    clearInterval(watchdogRef.current);
    recognitionRef.current?.stop();
    setInterim('');
    setIsListening(false);
  }, []);

  useEffect(
    () => () => {
      shouldRunRef.current = false;
      clearInterval(watchdogRef.current);
      recognitionRef.current?.stop();
    },
    []
  );

  return { supported: webSpeechSupported, interim, isListening, start, stop };
}
