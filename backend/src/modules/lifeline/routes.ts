import { Router } from 'express';
import { getLifelineBullets } from './service.js';
import { quotaGuard, recordCall } from '../../middleware/quotaGuard.js';

const router = Router();

router.post('/', quotaGuard('groqChat'), async (req, res) => {
  const { transcriptSnippet, platform, mode } = (req.body || {}) as {
    transcriptSnippet?: unknown;
    platform?: string;
    mode?: unknown;
  };
  if (typeof transcriptSnippet !== 'string' || !transcriptSnippet.trim()) {
    return res.status(400).json({ error: 'transcriptSnippet (string) is required' });
  }
  // Anything unrecognised falls back to the default turn-based coaching.
  const lifelineMode = mode === 'banter' ? 'banter' : 'turn';

  try {
    const { bullets, mock } = await getLifelineBullets(transcriptSnippet.slice(0, 4000), lifelineMode);
    if (!mock) recordCall('groqChat', { endpoint: '/api/lifeline', platform, mode: lifelineMode, ok: true });
    res.json({ bullets });
  } catch (err) {
    // The frontend fails silently mid-call; the 502 here is for logs, not for the VA's eyes.
    recordCall('groqChat', { endpoint: '/api/lifeline', platform, ok: false, error: (err as Error).message });
    console.error('lifeline error:', (err as Error).message);
    res.status(502).json({ error: 'lifeline-failed' });
  }
});

export default router;
