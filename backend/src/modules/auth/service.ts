import bcrypt from 'bcryptjs';
import { prisma } from '../../db.js';
import { config } from '../../config.js';
import { signToken } from '../../middleware/auth.js';
import { sendEmail } from '../../providers/email/index.js';
import {
  issueRefreshToken,
  consumeRefreshToken,
  revokeRefreshToken,
  revokeAllRefreshTokens,
  issueActionToken,
  consumeActionToken,
} from './tokens.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

export interface PublicUser {
  id: string;
  email: string;
  displayName: string | null;
  emailVerified: boolean;
  createdAt: Date;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
}

export class AuthError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
  }
}

type DbUser = { id: string; email: string; displayName: string | null; emailVerifiedAt: Date | null; createdAt: Date };

export function toPublicUser(user: DbUser): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    emailVerified: Boolean(user.emailVerifiedAt),
    createdAt: user.createdAt,
  };
}

export async function createSession(user: DbUser): Promise<Session> {
  return {
    accessToken: signToken(user),
    refreshToken: await issueRefreshToken(user.id),
    user: toPublicUser(user),
  };
}

async function sendVerificationEmail(user: { id: string; email: string }): Promise<void> {
  const token = await issueActionToken(user.id, 'verify-email');
  // /#/ = HashRouter path: works on the deployed web app AND in Electron (file://).
  const link = `${config.frontendUrl}/#/verify-email?token=${token}`;
  await sendEmail({
    to: user.email,
    subject: 'Verify your HusAI email',
    text: `Welcome to HusAI!\n\nConfirm your email address by opening this link:\n${link}\n\nThe link expires in 24 hours. If you didn't create a HusAI account, you can ignore this email.`,
  }).catch((err) => console.error('verification email failed:', (err as Error).message));
}

export async function register(email: unknown, password: unknown, displayName?: unknown): Promise<Session> {
  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    throw new AuthError(400, 'invalid-email', 'A valid email address is required.');
  }
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw new AuthError(400, 'weak-password', `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    throw new AuthError(409, 'email-taken', 'An account with this email already exists.');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash,
      displayName: typeof displayName === 'string' && displayName.trim() ? displayName.trim() : null,
      settings: { create: {} }, // defaults from the schema
    },
  });

  await sendVerificationEmail(user);
  return createSession(user);
}

export async function login(email: unknown, password: unknown): Promise<Session> {
  if (typeof email !== 'string' || typeof password !== 'string') {
    throw new AuthError(400, 'invalid-request', 'Email and password are required.');
  }

  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  // Same error for unknown email, wrong password, and OAuth-only accounts —
  // don't leak which emails have accounts or how they sign in.
  if (!user || !user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new AuthError(401, 'invalid-credentials', 'Incorrect email or password.');
  }

  return createSession(user);
}

export async function refreshSession(refreshToken: unknown): Promise<Session> {
  if (typeof refreshToken !== 'string' || !refreshToken) {
    throw new AuthError(400, 'invalid-request', 'refreshToken is required.');
  }
  const rotated = await consumeRefreshToken(refreshToken);
  if (!rotated) throw new AuthError(401, 'invalid-refresh-token', 'Session expired. Please sign in again.');

  const user = await prisma.user.findUnique({ where: { id: rotated.userId } });
  if (!user) throw new AuthError(401, 'invalid-refresh-token', 'Session expired. Please sign in again.');

  return { accessToken: signToken(user), refreshToken: rotated.newToken, user: toPublicUser(user) };
}

export async function logout(refreshToken: unknown): Promise<void> {
  if (typeof refreshToken === 'string' && refreshToken) await revokeRefreshToken(refreshToken);
}

export async function verifyEmail(token: unknown): Promise<PublicUser> {
  if (typeof token !== 'string' || !token) throw new AuthError(400, 'invalid-request', 'token is required.');
  const userId = await consumeActionToken(token, 'verify-email');
  if (!userId) throw new AuthError(400, 'invalid-token', 'This verification link is invalid or has expired.');
  const user = await prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
  return toPublicUser(user);
}

export async function resendVerification(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AuthError(404, 'not-found', 'Account not found.');
  if (user.emailVerifiedAt) throw new AuthError(400, 'already-verified', 'This email is already verified.');
  await sendVerificationEmail(user);
}

export async function requestPasswordReset(email: unknown): Promise<void> {
  // Always succeed from the caller's perspective — never reveal account existence.
  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) return;
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user) return;

  const token = await issueActionToken(user.id, 'reset-password');
  const link = `${config.frontendUrl}/#/reset-password?token=${token}`;
  await sendEmail({
    to: user.email,
    subject: 'Reset your HusAI password',
    text: `Someone requested a password reset for your HusAI account.\n\nSet a new password here:\n${link}\n\nThe link expires in 1 hour. If this wasn't you, ignore this email — your password is unchanged.`,
  }).catch((err) => console.error('reset email failed:', (err as Error).message));
}

export async function resetPassword(token: unknown, newPassword: unknown): Promise<void> {
  if (typeof token !== 'string' || !token) throw new AuthError(400, 'invalid-request', 'token is required.');
  if (typeof newPassword !== 'string' || newPassword.length < MIN_PASSWORD_LENGTH) {
    throw new AuthError(400, 'weak-password', `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  const userId = await consumeActionToken(token, 'reset-password');
  if (!userId) throw new AuthError(400, 'invalid-token', 'This reset link is invalid or has expired.');

  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(newPassword, 10) } });
  await revokeAllRefreshTokens(userId); // every existing session must re-authenticate
}

export async function changePassword(userId: string, currentPassword: unknown, newPassword: unknown): Promise<void> {
  if (typeof newPassword !== 'string' || newPassword.length < MIN_PASSWORD_LENGTH) {
    throw new AuthError(400, 'weak-password', `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AuthError(404, 'not-found', 'Account not found.');
  // OAuth-only accounts (no password yet) may set one without a current password.
  if (user.passwordHash) {
    if (typeof currentPassword !== 'string' || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new AuthError(401, 'invalid-credentials', 'Your current password is incorrect.');
    }
  }
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(newPassword, 10) } });
  await revokeAllRefreshTokens(userId); // sign out other devices; caller re-logs in
}

export async function getUserById(id: string): Promise<PublicUser | null> {
  const user = await prisma.user.findUnique({ where: { id } });
  return user ? toPublicUser(user) : null;
}
