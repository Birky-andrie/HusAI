import { Router } from 'express';
import { prisma } from '../../db.js';
import { config } from '../../config.js';
import { authRequired } from '../../middleware/auth.js';

const router = Router();

type DbUser = { id: string; email: string; displayName: string | null; emailVerifiedAt: Date | null; createdAt: Date };

// The app's public view of a user. Supabase owns credentials/verification; we
// keep displayName + settings as the app's own profile data.
function toPublicUser(user: DbUser) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    emailVerified: Boolean(user.emailVerifiedAt),
    createdAt: user.createdAt,
  };
}

// Everything under /api/me is the authenticated user's own data — never keyed
// by a client-supplied user id.
router.use('/me', authRequired);

router.get('/me', async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    include: { settings: true },
  });
  if (!user) {
    // Valid token but the user row is gone (deleted account).
    return res.status(401).json({ error: 'unauthorized' });
  }
  res.json({
    user: toPublicUser(user),
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

/** Best-effort removal of the Supabase auth identity — needs the service-role key. */
async function deleteSupabaseUser(id: string): Promise<void> {
  if (!config.supabaseServiceRoleKey) {
    console.warn(`account ${id} deleted locally, but SUPABASE_SERVICE_ROLE_KEY is unset — the Supabase auth user remains.`);
    return;
  }
  try {
    const resp = await fetch(`${config.supabaseUrl}/auth/v1/admin/users/${id}`, {
      method: 'DELETE',
      headers: {
        apikey: config.supabaseServiceRoleKey,
        Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
      },
    });
    if (!resp.ok) console.error(`Supabase admin delete failed for ${id}:`, resp.status, (await resp.text()).slice(0, 200));
  } catch (err) {
    console.error(`Supabase admin delete error for ${id}:`, (err as Error).message);
  }
}

router.delete('/me', async (req, res) => {
  // Cascades wipe settings, meetings, reviews, practice sessions/turns, and
  // progress metrics with the user row; then remove the Supabase auth identity.
  await prisma.user.delete({ where: { id: req.user!.id } });
  await deleteSupabaseUser(req.user!.id);
  res.json({ ok: true });
});

export default router;
