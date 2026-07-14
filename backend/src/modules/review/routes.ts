import { Router } from 'express';
import { reviewTranscript } from './service.js';
import { quotaGuard, recordCall } from '../../middleware/quotaGuard.js';

const router = Router();

router.post('/', quotaGuard('gemini'), async (req, res) => {
  const { fullTranscript, callDurationSeconds, platform } = (req.body || {}) as {
    fullTranscript?: unknown;
    callDurationSeconds?: number;
    platform?: string;
  };
  if (typeof fullTranscript !== 'string' || !fullTranscript.trim()) {
    return res.status(400).json({ error: 'fullTranscript (string) is required' });
  }

  try {
    const result = await reviewTranscript(fullTranscript, callDurationSeconds);
    const { mock, ...payload } = result;
    if (!mock) recordCall('gemini', { endpoint: '/api/review', platform, ok: true, transcriptChars: fullTranscript.length });
    res.json(payload);
  } catch (err) {
    recordCall('gemini', { endpoint: '/api/review', platform, ok: false, error: (err as Error).message });
    console.error('review error:', (err as Error).message);
    res.status(503).json({
      error: 'review-failed',
      message: 'Your review is taking longer than expected. Please try again in a moment.',
    });
  }
});

export default router;
