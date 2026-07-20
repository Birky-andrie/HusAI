import { Router } from 'express';
import { prisma } from '../../db.js';
import { authRequired } from '../../middleware/auth.js';
import { toPublicUser } from '../auth/service.js';

const router = Router();

// Everything under /api/me is the authenticated user's own data — never keyed
// by a client-supplied user id.
router.use('/me', authRequired);

router.get('/me', async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    include: { settings: true, oauthAccounts: { select: { provider: true, email: true, createdAt: true } } },
  });
  if (!user) {
    // Valid token but the user row is gone (deleted account).
    return res.status(401).json({ error: 'unauthorized' });
  }
  res.json({
    user: toPublicUser(user),
    hasPassword: Boolean(user.passwordHash),
    providers: user.oauthAccounts,
    settings: user.settings && {
      transcriptRetentionDays: user.settings.transcriptRetentionDays,
      lifelinePauseSeconds: user.settings.lifelinePauseSeconds,
      notificationPrefs: user.settings.notificationPrefsJson ? JSON.parse(user.settings.notificationPrefsJson) : {},
    },
  });
});

router.patch('/me', async (req, res) => {
  const { displayName } = (req.body || {}) as { displayName?: unknown };
  if (displayName !== undefined && typeof displayName !== 'string') {
    return res.status(400).json({ error: 'invalid-request', message: 'displayName must be a string.' });
  }
  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: { displayName: typeof displayName === 'string' ? displayName.trim() || null : undefined },
  });
  res.json({ user: toPublicUser(user) });
});

router.patch('/me/settings', async (req, res) => {
  const { transcriptRetentionDays, lifelinePauseSeconds, notificationPrefs } = (req.body || {}) as Record<string, unknown>;

  const data: Record<string, unknown> = {};
  if (transcriptRetentionDays !== undefined) {
    const days = Number(transcriptRetentionDays);
    if (!Number.isInteger(days) || days < 1 || days > 365) {
      return res.status(400).json({ error: 'invalid-request', message: 'transcriptRetentionDays must be 1-365.' });
    }
    data.transcriptRetentionDays = days;
  }
  if (lifelinePauseSeconds !== undefined) {
    const secs = Number(lifelinePauseSeconds);
    if (!Number.isFinite(secs) || secs < 1 || secs > 30) {
      return res.status(400).json({ error: 'invalid-request', message: 'lifelinePauseSeconds must be 1-30.' });
    }
    data.lifelinePauseSeconds = secs;
  }
  if (notificationPrefs !== undefined) {
    if (typeof notificationPrefs !== 'object' || notificationPrefs === null) {
      return res.status(400).json({ error: 'invalid-request', message: 'notificationPrefs must be an object.' });
    }
    data.notificationPrefsJson = JSON.stringify(notificationPrefs);
  }

  const settings = await prisma.userSettings.upsert({
    where: { userId: req.user!.id },
    update: data,
    create: { userId: req.user!.id, ...data },
  });
  res.json({
    settings: {
      transcriptRetentionDays: settings.transcriptRetentionDays,
      lifelinePauseSeconds: settings.lifelinePauseSeconds,
      notificationPrefs: settings.notificationPrefsJson ? JSON.parse(settings.notificationPrefsJson) : {},
    },
  });
});

router.delete('/me/providers/:provider', async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    include: { oauthAccounts: true },
  });
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  // Never sever the last way into the account.
  if (!user.passwordHash && user.oauthAccounts.length <= 1) {
    return res.status(400).json({
      error: 'last-sign-in-method',
      message: 'Set a password first — this is currently your only way to sign in.',
    });
  }
  await prisma.oAuthAccount.deleteMany({ where: { userId: user.id, provider: req.params.provider } });
  res.json({ ok: true });
});

router.delete('/me', async (req, res) => {
  // Cascades wipe settings, tokens, oauth accounts, meetings, reviews,
  // practice sessions/turns, and progress metrics with the user row.
  await prisma.user.delete({ where: { id: req.user!.id } });
  res.json({ ok: true });
});

export default router;
