import { useCallback, useEffect, useRef, useState } from 'react';

const SpeechRecognitionImpl =
  typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : undefined;

export const webSpeechSupported = Boolean(SpeechRecognitionImpl);

/**
 * Web build only. Chrome's SpeechRecognition silently stops (onend fires) after
 * long pauses or ~60s in some builds, so we auto-restart until the user
 * explicitly stops — transcription must never die mid-call.
 */
export default function useWebSpeechTranscription() {
  const [transcript, setTranscript] = useState([]); // [{ text, t }]
  const [interim, setInterim] = useState('');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  const shouldRunRef = useRef(false);

  const start = useCallback(() => {
    if (!SpeechRecognitionImpl || shouldRunRef.current) return;
    shouldRunRef.current = true;
    setTranscript([]);
    setInterim('');

    const spawn = () => {
      const rec = new SpeechRecognitionImpl();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';

      rec.onresult = (event) => {
        let interimText = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            const text = result[0].transcript.trim();
            if (text) setTranscript((prev) => [...prev, { text, t: Date.now() }]);
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
        if (!shouldRunRef.current) {
          setIsListening(false);
          return;
        }
        // Chrome's recognition service needs a beat to release after `end`
        // fires; restarting synchronously here throws InvalidStateError and
        // (without this retry) kills transcription for the rest of the call.
        const attemptRestart = (retriesLeft) => {
          if (!shouldRunRef.current) return;
          try {
            spawn();
          } catch {
            if (retriesLeft > 0) {
              setTimeout(() => attemptRestart(retriesLeft - 1), 300);
            } else {
              setIsListening(false);
            }
          }
        };
        setTimeout(() => attemptRestart(3), 250);
      };

      recognitionRef.current = rec;
      rec.start();
      setIsListening(true);
    };

    spawn();
  }, []);

  const stop = useCallback(() => {
    shouldRunRef.current = false;
    recognitionRef.current?.stop();
    setInterim('');
    setIsListening(false);
  }, []);

  useEffect(() => () => {
    shouldRunRef.current = false;
    recognitionRef.current?.stop();
  }, []);

  return { supported: webSpeechSupported, transcript, interim, isListening, start, stop };
}
