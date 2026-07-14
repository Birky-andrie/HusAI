import bcrypt from 'bcryptjs';
import { prisma } from '../../db.js';
import { signToken } from '../../middleware/auth.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

export interface PublicUser {
  id: string;
  email: string;
  displayName: string | null;
  createdAt: Date;
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

function toPublicUser(user: { id: string; email: string; displayName: string | null; createdAt: Date }): PublicUser {
  return { id: user.id, email: user.email, displayName: user.displayName, createdAt: user.createdAt };
}

export async function register(email: unknown, password: unknown, displayName?: unknown): Promise<{ token: string; user: PublicUser }> {
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

  return { token: signToken(user), user: toPublicUser(user) };
}

export async function login(email: unknown, password: unknown): Promise<{ token: string; user: PublicUser }> {
  if (typeof email !== 'string' || typeof password !== 'string') {
    throw new AuthError(400, 'invalid-request', 'Email and password are required.');
  }

  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  // Same error for unknown email and wrong password — don't leak which emails have accounts.
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new AuthError(401, 'invalid-credentials', 'Incorrect email or password.');
  }

  return { token: signToken(user), user: toPublicUser(user) };
}

export async function getUserById(id: string): Promise<PublicUser | null> {
  const user = await prisma.user.findUnique({ where: { id } });
  return user ? toPublicUser(user) : null;
}
