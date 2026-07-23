import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db.js';
import { config } from '../config.js';

export interface AuthUser {
  id: string;
  email: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

// Supabase signs access tokens with rotating asymmetric keys (ES256) exposed at
// the project's JWKS endpoint. `jose` caches the key set and refetches only when
// it sees an unknown `kid`, so verification is local and fast.
const JWKS = createRemoteJWKSet(new URL(`${config.supabaseUrl}/auth/v1/.well-known/jwks.json`));
const ISSUER = `${config.supabaseUrl}/auth/v1`;

// App-user rows we've already ensured exist this process — lets us skip the
// provisioning query on every subsequent request from the same user.
const provisioned = new Set<string>();

/**
 * Just-in-time provisioning: Supabase Auth owns identities (auth.users), but our
 * business tables key off the app `User` row. On first sight of a Supabase user
 * we mirror them into `User` with id = their Supabase uid, so every foreign key
 * lines up. A valid access token only exists post-confirmation, so we treat the
 * email as verified here.
 */
async function ensureUser(id: string, email: string, displayName: string | null): Promise<void> {
  if (provisioned.has(id)) return;
  try {
    await prisma.user.upsert({
      where: { id },
      update: {}, // Supabase remains the source of truth for email/verification.
      create: { id, email, displayName, emailVerifiedAt: new Date(), settings: { create: {} } },
    });
  } catch (e) {
    // A concurrent first request can double-create; a unique violation just means
    // the row is already there. Anything else is a real error.
    if ((e as { code?: string }).code !== 'P2002') throw e;
  }
  provisioned.add(id);
}

/**
 * Verify a Supabase access token and resolve it to our app user, provisioning
 * the row on first sight. Returns null on any failure. Shared by the HTTP
 * middleware and the WebSocket handshake.
 */
export async function verifyToken(token: string): Promise<AuthUser | null> {
  if (!config.supabaseUrl) return null;
  try {
    const { payload } = await jwtVerify(token, JWKS, { issuer: ISSUER, audience: 'authenticated' });
    const id = payload.sub;
    const email = typeof payload.email === 'string' ? payload.email : '';
    if (!id) return null;
    // Supabase nests the profile name under user_metadata.
    const meta = (payload.user_metadata ?? {}) as Record<string, unknown>;
    const name = typeof meta.full_name === 'string' ? meta.full_name : typeof meta.name === 'string' ? meta.name : null;
    await ensureUser(id, email, name);
    return { id, email };
  } catch {
    return null;
  }
}

export async function authRequired(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
  const user = token ? await verifyToken(token) : null;
  if (!user) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  req.user = user;
  next();
}
