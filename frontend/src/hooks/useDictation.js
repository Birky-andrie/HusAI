import { useCallback, useEffect, useRef, useState } from 'react';
import useWebSpeechTranscription, { webSpeechSupported } from './useWebSpeechTranscription.js';
import useSegmentTranscription from './useSegmentTranscription.js';

/**
 * Push-to-talk dictation into a text field.
 *
 * Same two-engine split the live call uses, for the same reason: Electron has
 * no Web Speech API, so the desktop build records audio and sends segments to
 * Whisper, while the web build streams through Chrome's recogniser. This hook
 * hides that difference behind start/stop and a growing `text` string.
 *
 * Not the same as the call's transcription: there is one speaker, no merging,
 * no Lifeline, and the output is a draft the user edits before sending. So it
 * owns the mic stream itself rather than borrowing the call session's.
 */
export default function useDictation({ onText } = {}) {
  const isDesktop = Boolean(typeof window !== 'undefined' && window.electronAPI?.isDesktop);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState('');
  const [stream, setStream] = useState(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  // Both engines report finished phrases the same way, so they share a sink.
  const handleLine = useCallback(({ text }) => {
    if (text?.trim()) onTextRef.current?.(text.trim());
  }, []);

  const webSpeech = useWebSpeechTranscription({ onLine: handleLine });
  const desktop = useSegmentTranscription({ stream, speaker: 'va', onLine: handleLine });

  const supported = isDesktop || webSpeechSupported;

  const start = useCallback(async () => {
    if (recording || !supported) return;
    setError('');
    try {
      // Requested per dictation rather than held open: a permanently live mic
      // on a practice page is both a privacy smell and a battery cost.
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setStream(micStream);
      setRecording(true);
      if (!isDesktop) webSpeech.start();
    } catch {
      setError('We could not access your microphone. Check your browser permissions and try again.');
    }
  }, [recording, supported, isDesktop, webSpeech]);

  const stop = useCallback(async () => {
    if (!recording) return;
    setRecording(false);
    // Desktop must flush the in-flight audio segment before the tracks die, or
    // the last thing the user said is lost with the stream.
    if (isDesktop) await desktop.stop();
    else webSpeech.stop();
    setStream((current) => {
      current?.getTracks().forEach((t) => t.stop());
      return null;
    });
  }, [recording, isDesktop, desktop, webSpeech]);

  // Desktop segmentation only runs while there is a stream to record.
  useEffect(() => {
    if (isDesktop && stream && recording) desktop.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDesktop, stream, recording]);

  // Releasing the mic on unmount is not optional — navigating away mid-dictation
  // would otherwise leave the browser's recording indicator on indefinitely.
  useEffect(() => {
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [stream]);

  return {
    supported,
    recording,
    error,
    /** Live partial text on web; always '' on desktop, which has no interim. */
    interim: !isDesktop && recording ? webSpeech.interim : '',
    start,
    stop,
    toggle: () => (recording ? stop() : start()),
  };
}
