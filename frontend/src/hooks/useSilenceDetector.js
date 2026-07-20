import { useEffect, useRef } from 'react';

/**
 * Platform-agnostic amplitude VAD on a raw audio stream (AnalyserNode).
 * Independent of whichever STT engine is running, so the Lifeline behaves
 * identically on web and desktop.
 *
 * State machine sampled every 100ms:
 * - `speaking` requires `speechFrames` CONSECUTIVE loud frames (~400ms) — a
 *   keystroke, cough, or breath is a blip, not speech, and must neither clear
 *   the Lifeline (onSpeech) nor reset the silence clock.
 * - onSilence fires after `silenceSeconds` of continuous quiet, debounced by
 *   `cooldownSeconds`, and only after at least one real speech stretch this
 *   session ("goes silent MID-call" — never 4s after a call starts in silence).
 * - While `suppressRef.current` is true (the other party is talking), the
 *   silence clock RESETS each tick: their speech is conversation activity, so
 *   the VA gets a fresh `silenceSeconds` window after they finish.
 * - `speakingRef`, when provided, mirrors the live speaking state — used to run
 *   this hook as a bare "is this channel talking?" probe on the client stream.
 */
export default function useSilenceDetector({
  stream,
  active,
  onSilence,
  onSpeech,
  silenceSeconds = 4,
  cooldownSeconds = 8,
  volumeThreshold = 0.015, // RMS of time-domain samples; ~quiet room noise floor
  speechFrames = 4, // consecutive 100ms frames above threshold = sustained speech
  suppressRef, // optional: while .current is true, the silence clock keeps resetting
  speakingRef, // optional out-param: .current mirrors the speaking state
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
    let speaking = false;
    let hadSpeechThisSession = false;
    let loudRun = 0;
    let quietRun = 0;
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
        loudRun += 1;
        quietRun = 0;
        if (!speaking && loudRun >= speechFrames) {
          speaking = true;
          hadSpeechThisSession = true;
          silenceStartedAt = null;
          firedForThisSilence = false;
          if (speakingRef) speakingRef.current = true;
          onSpeechRef.current?.();
        }
        return;
      }

      quietRun += 1;
      loudRun = 0;
      if (speaking && quietRun >= 2) {
        speaking = false;
        if (speakingRef) speakingRef.current = false;
        silenceStartedAt = now;
      }
      if (speaking) return; // 100ms of quiet inside a sentence — not silence yet

      // The other party talking is conversation activity: keep resetting the
      // clock so the VA gets a full silenceSeconds window after they finish.
      if (suppressRef?.current) {
        silenceStartedAt = now;
        firedForThisSilence = false;
        return;
      }

      if (silenceStartedAt === null) {
        silenceStartedAt = now;
        return;
      }

      const silentFor = (now - silenceStartedAt) / 1000;
      const sinceLastTrigger = (now - lastTriggerAt) / 1000;
      if (
        hadSpeechThisSession &&
        !firedForThisSilence &&
        silentFor >= silenceSeconds &&
        sinceLastTrigger >= cooldownSeconds
      ) {
        firedForThisSilence = true; // one trigger per silence stretch; cooldown guards flaky toggling
        lastTriggerAt = now;
        onSilenceRef.current?.();
      }
    }, 100);

    return () => {
      clearInterval(timer);
      if (speakingRef) speakingRef.current = false;
      source.disconnect();
      audioCtx.close().catch(() => {});
    };
  }, [stream, active, silenceSeconds, cooldownSeconds, volumeThreshold, speechFrames, suppressRef, speakingRef]);
}
