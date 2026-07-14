import { useCallback, useEffect, useRef, useState } from 'react';
import { postJSON } from '../lib/api.js';

// Desktop chunk interval. Bigger = fewer Groq Whisper requests (2,000/day org-wide
// free cap) but staler transcript. 50 users × 30-min calls at 60s ≈ 1,500 req/day.
export const CHUNK_SECONDS = 60;

const PREFERRED_MIMES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];

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
 * Desktop build only. Electron's Chromium has no Web Speech backend, so we
 * record rolling ~60s segments and send each to /api/transcribe (Groq Whisper).
 * Not real-time streaming — an accepted latency trade-off for the alpha.
 *
 * flushNow() finalizes the in-progress segment immediately and resolves once its
 * text is in the transcript — the Lifeline calls this on a silence trigger so it
 * coaches on what was just said, not on a segment up to 60s stale.
 */
export default function useWhisperTranscription(stream) {
  const [transcript, setTranscript] = useState([]); // [{ text, t }]
  const [isListening, setIsListening] = useState(false);
  const recorderRef = useRef(null);
  const shouldRunRef = useRef(false);
  const rotateTimerRef = useRef(null);
  const segmentPromiseRef = useRef(Promise.resolve());
  const mimeTypeRef = useRef('');

  const transcribeSegment = useCallback(async (blob) => {
    if (!blob || blob.size < 1000) return; // skip near-empty segments (pure silence)
    try {
      const audioBase64 = await blobToBase64(blob);
      const { text } = await postJSON('/api/transcribe', {
        audioBase64,
        mimeType: mimeTypeRef.current || blob.type,
      });
      if (text) setTranscript((prev) => [...prev, { text, t: Date.now() }]);
    } catch (err) {
      // Never interrupt the call over a failed chunk; the next segment continues.
      console.warn('transcribe chunk failed:', err.message);
    }
  }, []);

  // Stops the current recorder, sends its audio, and starts the next segment.
  const rotateSegment = useCallback(() => {
    const rec = recorderRef.current;
    if (!rec || rec.state !== 'recording') return segmentPromiseRef.current;

    const chunks = [];
    const done = new Promise((resolve) => {
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      rec.onstop = async () => {
        await transcribeSegment(new Blob(chunks, { type: mimeTypeRef.current }));
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
    const rec = new MediaRecorder(stream, mimeTypeRef.current ? { mimeType: mimeTypeRef.current } : undefined);
    recorderRef.current = rec;
    rec.start(); // no timeslice: one self-contained (header-complete) blob per segment
    clearTimeout(rotateTimerRef.current);
    rotateTimerRef.current = setTimeout(() => rotateSegment(), CHUNK_SECONDS * 1000);
  };

  const start = useCallback(() => {
    if (!stream || shouldRunRef.current) return;
    mimeTypeRef.current = pickMimeType();
    shouldRunRef.current = true;
    setTranscript([]);
    startSegmentRef.current();
    setIsListening(true);
  }, [stream]);

  const stop = useCallback(async () => {
    if (!shouldRunRef.current) return;
    shouldRunRef.current = false;
    clearTimeout(rotateTimerRef.current);
    await rotateSegment(); // flush the tail so the review sees the whole call
    setIsListening(false);
  }, [rotateSegment]);

  const flushNow = useCallback(async () => {
    if (!shouldRunRef.current) return;
    clearTimeout(rotateTimerRef.current);
    await rotateSegment();
  }, [rotateSegment]);

  useEffect(() => () => {
    shouldRunRef.current = false;
    clearTimeout(rotateTimerRef.current);
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  }, []);

  return { transcript, isListening, start, stop, flushNow };
}
