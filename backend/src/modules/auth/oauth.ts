import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../../db.js';
import { config } from '../../config.js';
import { createSession, AuthError } from './service.js';

/**
 * Google & Microsoft sign-in via the server-side authorization-code flow —
 * plain fetch against the providers' endpoints, no passport. A provider is
 * active only when both its env vars are set; GET /api/auth/providers tells
 * the frontend which buttons to render.
 *
 * Flow: /start → 302 to provider (state = signed 10-min JWT)
 *       /callback → code exchange → userinfo → upsert user + OAuthAccount
 *                 → 302 to `${FRONTEND_URL}/#/oauth-complete?ticket=<60s JWT>`
 *       POST /complete { ticket } → full session (access + refresh tokens).
 * The ticket hop keeps real tokens out of server logs: everything after the #
 * (the hash route AND its query) never leaves the browser.
 */

interface OAuthProviderDef {
  authorizeUrl: string;
  tokenUrl: string;
  userinfoUrl: string;
  scope: string;
  clientId: () => string;
  clientSecret: () => string;
}

const PROVIDERS: Record<string, OAuthProviderDef> = {
  google: {
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userinfoUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
    scope: 'openid email profile',
    clientId: () => config.googleClientId,
    clientSecret: () => config.googleClientSecret,
  },
  microsoft: {
    authorizeUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    userinfoUrl: 'https://graph.microsoft.com/oidc/userinfo',
    scope: 'openid email profile',
    clientId: () => config.msClientId,
    clientSecret: () => config.msClientSecret,
  },
};

export function enabledProviders(): Record<string, boolean> {
  return Object.fromEntries(
    Object.entries(PROVIDERS).map(([name, def]) => [name, Boolean(def.clientId() && def.clientSecret())])
  );
}

function redirectUri(provider: string): string {
  return `${config.apiBaseUrl}/api/auth/oauth/${provider}/callback`;
}

function getProvider(name: string): OAuthProviderDef {
  const def = PROVIDERS[name];
  if (!def || !def.clientId() || !def.clientSecret()) {
    throw new AuthError(404, 'provider-not-configured', `Sign-in with ${name} is not configured.`);
  }
  return def;
}

const router = Router();

router.get('/:provider/start', (req, res) => {
  try {
    const name = req.params.provider;
    const def = getProvider(name);
    const state = jwt.sign({ purpose: 'oauth-state', provider: name }, config.jwtSecret, { expiresIn: '10m' });
    const url = new URL(def.authorizeUrl);
    url.searchParams.set('client_id', def.clientId());
    url.searchParams.set('redirect_uri', redirectUri(name));
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', def.scope);
    url.searchParams.set('state', state);
    res.redirect(url.toString());
  } catch (err) {
    if (err instanceof AuthError) return res.status(err.status).json({ error: err.code, message: err.message });
    res.status(500).json({ error: 'oauth-failed' });
  }
});

router.get('/:provider/callback', async (req, res) => {
  const failTo = `${config.frontendUrl}/#/login?error=oauth-failed`;
  try {
    const name = req.params.provider;
    const def = getProvider(name);
    const { code, state } = req.query as { code?: string; state?: string };
    if (!code || !state) return res.redirect(failTo);

    const statePayload = jwt.verify(state, config.jwtSecret) as { purpose?: string; provider?: string };
    if (statePayload.purpose !== 'oauth-state' || statePayload.provider !== name) return res.redirect(failTo);

    const tokenResp = await fetch(def.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: def.clientId(),
        client_secret: def.clientSecret(),
        redirect_uri: redirectUri(name),
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenResp.ok) {
      console.error(`oauth ${name} token exchange failed:`, tokenResp.status, (await tokenResp.text()).slice(0, 200));
      return res.redirect(failTo);
    }
    const tokens = (await tokenResp.json()) as { access_token?: string };
    if (!tokens.access_token) return res.redirect(failTo);

    const infoResp = await fetch(def.userinfoUrl, { headers: { Authorization: `Bearer ${tokens.access_token}` } });
    if (!infoResp.ok) return res.redirect(failTo);
    const info = (await infoResp.json()) as { sub?: string; email?: string; name?: string };
    if (!info.sub || !info.email) return res.redirect(`${config.frontendUrl}/#/login?error=oauth-no-email`);
    const email = info.email.trim().toLowerCase();

    // 1) Known provider account → its user. 2) Same email → link. 3) New user.
    let userId: string;
    const linked = await prisma.oAuthAccount.findUnique({
      where: { provider_providerAccountId: { provider: name, providerAccountId: info.sub } },
    });
    if (linked) {
      userId = linked.userId;
    } else {
      const byEmail = await prisma.user.findUnique({ where: { email } });
      if (byEmail) {
        userId = byEmail.id;
      } else {
        const created = await prisma.user.create({
          data: {
            email,
            passwordHash: '', // OAuth-only until they set a password in Settings
            displayName: info.name || null,
            emailVerifiedAt: new Date(), // the provider vouches for the address
            settings: { create: {} },
          },
        });
        userId = created.id;
      }
      await prisma.oAuthAccount.create({
        data: { userId, provider: name, providerAccountId: info.sub, email },
      });
      // Signing in through a provider proves address ownership.
      await prisma.user.updateMany({ where: { id: userId, emailVerifiedAt: null }, data: { emailVerifiedAt: new Date() } });
    }

    const ticket = jwt.sign({ purpose: 'oauth-ticket' }, config.jwtSecret, { subject: userId, expiresIn: '60s' });
    // Hash-route with the ticket as an in-hash query param — nothing after the
    // # is ever sent to a server, so the ticket stays out of logs entirely.
    res.redirect(`${config.frontendUrl}/#/oauth-complete?ticket=${ticket}`);
  } catch (err) {
    console.error('oauth callback error:', (err as Error).message);
    res.redirect(failTo);
  }
});

router.post('/complete', async (req, res) => {
  try {
    const { ticket } = (req.body || {}) as { ticket?: string };
    if (typeof ticket !== 'string' || !ticket) return res.status(400).json({ error: 'invalid-request' });
    const payload = jwt.verify(ticket, config.jwtSecret) as { purpose?: string; sub?: string };
    if (payload.purpose !== 'oauth-ticket' || !payload.sub) return res.status(401).json({ error: 'invalid-ticket' });
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) return res.status(401).json({ error: 'invalid-ticket' });
    res.json(await createSession(user));
  } catch {
    res.status(401).json({ error: 'invalid-ticket' });
  }
});

export default router;
