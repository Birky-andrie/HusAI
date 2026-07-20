import { useCallback, useEffect, useRef, useState } from 'react';
import { postJSON } from '../lib/api.js';

const PREFERRED_MIMES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
const VAD_THRESHOLD = 0.015; // RMS; matches useSilenceDetector's noise floor

function pickMimeType() {
  if (typeof MediaRecorder === 'undefined') return '';
  return PREFERRED_MIMES.find((m) => MediaRecorder.isTypeSupported(m)) || '';
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Chunked Whisper transcription for any audio MediaStream — the VA's mic on
 * desktop (Electron has no Web Speech backend) or the client's tab/system
 * audio on either platform. Records rolling segments and sends each to
 * /api/transcribe. Not real-time streaming — an accepted latency trade-off
 * until a streaming SttProvider lands (see migration plan).
 *
 * Quota guard: a parallel amplitude VAD watches each segment; segments with no
 * speech are dropped client-side, so silence costs zero Whisper requests
 * (org-wide free cap is 2,000/day).
 *
 * Lines are delivered as { speaker, text, t } where t is the SEGMENT START
 * time — so client lines interleave correctly with the VA's live lines even
 * though Whisper results arrive chunkSeconds late.
 *
 * flushNow() finalizes the in-progress segment immediately and resolves once
 * its text has been delivered — the Lifeline calls this on a silence trigger
 * so it coaches on what was just said, not on a segment up to chunkSeconds
 * stale.
 */
export default function useSegmentTranscription(stream, { speaker, onLine, chunkSeconds = 10 } = {}) {
  const [isListening, setIsListening] = useState(false);
  const onLineRef = useRef(onLine);
  onLineRef.current = onLine;
  const recorderRef = useRef(null);
  const shouldRunRef = useRef(false);
  const rotateTimerRef = useRef(null);
  const segmentPromiseRef = useRef(Promise.resolve());
  const mimeTypeRef = useRef('');
  const audioCtxRef = useRef(null);
  const vadTimerRef = useRef(null);
  const segmentHadSpeechRef = useRef(false);
  const segmentStartedAtRef = useRef(0);

  const transcribeSegment = useCallback(
    async (blob, hadSpeech, tStart) => {
      if (!blob || blob.size < 1000) return; // near-empty container, nothing recorded
      if (!hadSpeech) return; // pure silence — don't spend a Whisper request on it
      try {
        const audioBase64 = await blobToBase64(blob);
        const { text } = await postJSON('/api/transcribe', {
          audioBase64,
          mimeType: mimeTypeRef.current || blob.type,
        });
        if (text) onLineRef.current?.({ speaker, text, t: tStart });
      } catch (err) {
        // Never interrupt the call over a failed chunk; the next segment continues.
        console.warn(`transcribe ${speaker} chunk failed:`, err.message);
      }
    },
    [speaker]
  );

  // Stops the current recorder, sends its audio, and starts the next segment.
  const rotateSegment = useCallback(() => {
    const rec = recorderRef.current;
    if (!rec || rec.state !== 'recording') return segmentPromiseRef.current;

    const hadSpeech = segmentHadSpeechRef.current;
    const tStart = segmentStartedAtRef.current;
    const chunks = [];
    const done = new Promise((resolve) => {
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      rec.onstop = async () => {
        await transcribeSegment(new Blob(chunks, { type: mimeTypeRef.current }), hadSpeech, tStart);
        resolve();
        if (shouldRunRef.current) startSegmentRef.current?.();
      };
    });
    segmentPromiseRef.current = done;
    rec.stop(); // triggers a final ondataavailable, then onstop
    return done;
  }, [transcribeSegment]);

  const startSegmentRef = useRef(null);
  startSegmentRef.current = () => {
    if (!shouldRunRef.current || !stream) return;
    // Record ONLY audio — display-capture streams carry a video track we must ignore.
    const audioTracks = stream.getAudioTracks();
    if (!audioTracks.length) return;
    const audioStream = new MediaStream(audioTracks);
    const rec = new MediaRecorder(audioStream, mimeTypeRef.current ? { mimeType: mimeTypeRef.current } : undefined);
    recorderRef.current = rec;
    segmentHadSpeechRef.current = false;
    segmentStartedAtRef.current = Date.now();
    rec.start(); // no timeslice: one self-contained (header-complete) blob per segment
    clearTimeout(rotateTimerRef.current);
    rotateTimerRef.current = setTimeout(() => rotateSegment(), chunkSeconds * 1000);
  };

  const start = useCallback(() => {
    if (!stream || shouldRunRef.current) return;
    mimeTypeRef.current = pickMimeType();
    shouldRunRef.current = true;

    // Segment-level VAD: flag the current segment as containing speech.
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    audioCtxRef.current = audioCtx;
    const samples = new Float32Array(analyser.fftSize);
    vadTimerRef.current = setInterval(() => {
      analyser.getFloatTimeDomainData(samples);
      let sumSquares = 0;
      for (let i = 0; i < samples.length; i++) sumSquares += samples[i] * samples[i];
      if (Math.sqrt(sumSquares / samples.length) >= VAD_THRESHOLD) {
        segmentHadSpeechRef.current = true;
      }
    }, 100);

    startSegmentRef.current();
    setIsListening(true);
  }, [stream]);

  const stopCapture = useCallback(() => {
    clearInterval(vadTimerRef.current);
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
  }, []);

  const stop = useCallback(async () => {
    if (!shouldRunRef.current) return;
    shouldRunRef.current = false;
    clearTimeout(rotateTimerRef.current);
    await rotateSegment(); // flush the tail so the review sees the whole call
    stopCapture();
    setIsListening(false);
  }, [rotateSegment, stopCapture]);

  const flushNow = useCallback(async () => {
    if (!shouldRunRef.current) return;
    clearTimeout(rotateTimerRef.current);
    await rotateSegment();
  }, [rotateSegment]);

  useEffect(
    () => () => {
      shouldRunRef.current = false;
      clearTimeout(rotateTimerRef.current);
      clearInterval(vadTimerRef.current);
      audioCtxRef.current?.close().catch(() => {});
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    },
    []
  );

  return { isListening, start, stop, flushNow };
}
