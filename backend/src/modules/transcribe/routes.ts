import { Router } from 'express';
import { groqWhisper } from '../../providers/stt/groqWhisper.js';
import { quotaGuard, recordCall } from '../../middleware/quotaGuard.js';

const router = Router();

// Desktop only: Electron can't use the Web Speech API, so audio chunks come here for Whisper.
router.post('/', quotaGuard('groqWhisper'), async (req, res) => {
  const { audioBase64, mimeType } = (req.body || {}) as { audioBase64?: unknown; mimeType?: string };
  if (typeof audioBase64 !== 'string' || !audioBase64) {
    return res.status(400).json({ error: 'audioBase64 (string) is required' });
  }

  let audioBuffer: Buffer;
  try {
    audioBuffer = Buffer.from(audioBase64, 'base64');
  } catch {
    return res.status(400).json({ error: 'audioBase64 is not valid base64' });
  }
  if (audioBuffer.length < 100) {
    return res.status(400).json({ error: 'audio chunk too small' });
  }

  if (!groqWhisper.available) {
    return res.json({ text: '[mock transcription — set GROQ_API_KEY to enable Whisper]' });
  }

  try {
    const { text } = await groqWhisper.transcribeSegment({ audio: audioBuffer, mimeType: mimeType || 'audio/webm' });
    recordCall('groqWhisper', {
      endpoint: '/api/transcribe',
      platform: 'desktop',
      ok: true,
      audioBytes: audioBuffer.length,
    });
    res.json({ text });
  } catch (err) {
    recordCall('groqWhisper', { endpoint: '/api/transcribe', platform: 'desktop', ok: false, error: (err as Error).message });
    console.error('transcribe error:', (err as Error).message);
    res.status(502).json({ error: 'transcribe-failed' });
  }
});

export default router;
