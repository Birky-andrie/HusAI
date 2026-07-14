import { useEffect, useRef } from 'react';

/**
 * Platform-agnostic amplitude VAD on the raw mic stream (AnalyserNode).
 * Independent of whichever STT engine is running, so the Lifeline behaves
 * identically on web and desktop.
 *
 * - onSilence fires after `silenceSeconds` of continuous low volume,
 *   debounced by `cooldownSeconds`.
 * - onSpeech fires on each silence→speech transition (used to clear the card).
 */
export default function useSilenceDetector({
  stream,
  active,
  onSilence,
  onSpeech,
  silenceSeconds = 4,
  cooldownSeconds = 8,
  volumeThreshold = 0.015, // RMS of time-domain samples; ~quiet room noise floor
}) {
  const onSilenceRef = useRef(onSilence);
  const onSpeechRef = useRef(onSpeech);
  onSilenceRef.current = onSilence;
  onSpeechRef.current = onSpeech;

  useEffect(() => {
    if (!stream || !active) return undefined;

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);

    const samples = new Float32Array(analyser.fftSize);
    let silenceStartedAt = null;
    let lastTriggerAt = 0;
    let firedForThisSilence = false;

    const timer = setInterval(() => {
      analyser.getFloatTimeDomainData(samples);
      let sumSquares = 0;
      for (let i = 0; i < samples.length; i++) sumSquares += samples[i] * samples[i];
      const rms = Math.sqrt(sumSquares / samples.length);
      const now = Date.now();

      if (rms >= volumeThreshold) {
        if (silenceStartedAt !== null) onSpeechRef.current?.();
        silenceStartedAt = null;
        firedForThisSilence = false;
        return;
      }

      if (silenceStartedAt === null) {
        silenceStartedAt = now;
        return;
      }

      const silentFor = (now - silenceStartedAt) / 1000;
      const sinceLastTrigger = (now - lastTriggerAt) / 1000;
      if (!firedForThisSilence && silentFor >= silenceSeconds && sinceLastTrigger >= cooldownSeconds) {
        firedForThisSilence = true; // one trigger per silence stretch; cooldown guards flaky toggling
        lastTriggerAt = now;
        onSilenceRef.current?.();
      }
    }, 100);

    return () => {
      clearInterval(timer);
      source.disconnect();
      audioCtx.close().catch(() => {});
    };
  }, [stream, active, silenceSeconds, cooldownSeconds, volumeThreshold]);
}
