import { Router } from 'express';
import { prisma } from '../../db.js';
import { config } from '../../config.js';
import { authRequired, forgetProvisioned } from '../../middleware/auth.js';
import { resolveEntitlements } from '../../lib/entitlements.js';
import { usageStatusForUser } from '../../lib/usage.js';
import { TERMS_VERSION } from '../../lib/terms.js';
import { cancelSubscriptionForUser } from '../billing/service.js';
import { stripeEnabled } from '../billing/stripe.js';

const router = Router();

type DbUser = {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  emailVerifiedAt: Date | null;
  createdAt: Date;
};

// The app's public view of a user. Supabase owns credentials/verification; we
// keep displayName + avatar + settings as the app's own profile data.
function toPublicUser(user: DbUser) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    emailVerified: Boolean(user.emailVerifiedAt),
    createdAt: user.createdAt,
  };
}

// ~400 KB cap on the stored data URL — a 128px avatar is well under this; the
// guard just stops an oversized payload from bloating the row / responses.
const MAX_AVATAR_CHARS = 400_000;

// Everything under /api/me is the authenticated user's own data — never keyed
// by a client-supplied user id.
router.use('/me', authRequired);

router.get('/me', async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    include: { settings: true, subscription: true },
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
    // Always server-derived — the client never decides its own plan.
    subscription: resolveEntitlements(user.subscription, user),
    terms: {
      acceptedAt: user.termsAcceptedAt,
      acceptedVersion: user.termsAcceptedVersion,
      currentVersion: TERMS_VERSION,
      // True when they have never accepted, or accepted an older version and
      // need to re-consent. RA 10173 treats consent as specific to what was
      // disclosed, so materially new terms need fresh agreement.
      needsAcceptance: user.termsAcceptedVersion !== TERMS_VERSION,
    },
  });
});

/**
 * Current usage against the plan's limits. The client calls this before
 * offering to start a call, so a free user who is out of allowance is stopped
 * at the button rather than after they have already talked to a client.
 */
router.get('/me/usage', async (req, res) => {
  res.json(await usageStatusForUser(req.user!.id));
});

/**
 * Record acceptance of the terms. Stores WHICH version was agreed to, because
 * "they clicked yes once" is not evidence of consent to terms written later.
 */
router.post('/me/accept-terms', async (req, res) => {
  const { version } = (req.body || {}) as { version?: unknown };
  if (version !== TERMS_VERSION) {
    return res.status(400).json({
      error: 'invalid-request',
      message: `Expected terms version ${TERMS_VERSION}.`,
      currentVersion: TERMS_VERSION,
    });
  }
  await prisma.user.update({
    where: { id: req.user!.id },
    data: { termsAcceptedAt: new Date(), termsAcceptedVersion: TERMS_VERSION },
  });
  res.json({ ok: true, acceptedVersion: TERMS_VERSION });
});

router.patch('/me', async (req, res) => {
  const { displayName, avatarUrl } = (req.body || {}) as { displayName?: unknown; avatarUrl?: unknown };

  const data: Record<string, unknown> = {};
  if (displayName !== undefined) {
    if (typeof displayName !== 'string') {
      return res.status(400).json({ error: 'invalid-request', message: 'displayName must be a string.' });
    }
    data.displayName = displayName.trim() || null;
  }
  if (avatarUrl !== undefined) {
    // null / empty string → clear the avatar; otherwise require a small image data URL.
    if (avatarUrl === null || avatarUrl === '') {
      data.avatarUrl = null;
    } else if (typeof avatarUrl !== 'string' || !avatarUrl.startsWith('data:image/')) {
      return res.status(400).json({ error: 'invalid-request', message: 'avatarUrl must be an image data URL.' });
    } else if (avatarUrl.length > MAX_AVATAR_CHARS) {
      return res.status(413).json({ error: 'too-large', message: 'That image is too large. Please choose a smaller one.' });
    } else {
      data.avatarUrl = avatarUrl;
    }
  }

  const user = await prisma.user.update({ where: { id: req.user!.id }, data });
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

/**
 * Remove the Supabase auth identity. Returns whether it actually happened.
 *
 * This is not cosmetic. Sign-in is owned by Supabase, and our `User` row is
 * re-created just-in-time on the next authenticated request (see
 * middleware/auth.ts). So if the auth identity survives, the "deleted" account
 * can be signed straight back into and is silently reborn — the deletion did
 * not happen in any sense the user would recognise. The caller reports this
 * honestly rather than claiming success.
 */
async function deleteSupabaseUser(id: string): Promise<{ ok: boolean; reason?: string }> {
  if (!config.supabaseServiceRoleKey) {
    console.error(
      `account ${id}: app data deleted, but SUPABASE_SERVICE_ROLE_KEY is unset so the Supabase auth identity REMAINS. ` +
        `This user can sign in again and be re-provisioned. Set the key to make deletion final.`
    );
    return { ok: false, reason: 'service-role-key-missing' };
  }
  try {
    const resp = await fetch(`${config.supabaseUrl}/auth/v1/admin/users/${id}`, {
      method: 'DELETE',
      headers: {
        apikey: config.supabaseServiceRoleKey,
        Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
      },
    });
    if (!resp.ok) {
      console.error(`Supabase admin delete failed for ${id}:`, resp.status, (await resp.text()).slice(0, 200));
      return { ok: false, reason: `supabase-${resp.status}` };
    }
    return { ok: true };
  } catch (err) {
    console.error(`Supabase admin delete error for ${id}:`, (err as Error).message);
    return { ok: false, reason: 'supabase-unreachable' };
  }
}

router.delete('/me', async (req, res) => {
  const userId = req.user!.id;

  // Cancel billing FIRST — deleting the row would otherwise orphan a live
  // subscription and keep charging someone who no longer has an account.
  // Best-effort by design: a Stripe outage must not block account deletion.
  if (stripeEnabled()) await cancelSubscriptionForUser(userId);

  // Cascades wipe settings, subscription, meetings, reviews, practice
  // sessions/turns, and progress metrics with the user row.
  await prisma.user.delete({ where: { id: userId } });

  // Drop the JIT-provisioning cache entry, or a signed-in token for this id
  // would keep skipping the upsert and operate against a nonexistent row.
  forgetProvisioned(userId);

  const identity = await deleteSupabaseUser(userId);

  // 200 either way — the user's data IS gone, and there is nothing they can do
  // about a server-side config gap. `identityRemoved: false` tells the client
  // (and anyone reading logs) that sign-in credentials may still exist.
  res.json({ ok: true, identityRemoved: identity.ok, reason: identity.reason });
});

export default router;
