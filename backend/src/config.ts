import 'dotenv/config';
import crypto from 'node:crypto';

// Missing JWT_SECRET falls back to a per-boot random secret: auth still works in
// dev, but every restart invalidates tokens — loud warning instead of a footgun.
const jwtSecret = process.env.JWT_SECRET || crypto.randomBytes(48).toString('base64url');
if (!process.env.JWT_SECRET) {
  console.warn('JWT_SECRET not set — using an ephemeral secret; sessions will not survive a restart.');
}

export const config = {
  port: Number(process.env.PORT || 3001),
  frontendOrigin: process.env.FRONTEND_ORIGIN || undefined,
  groqApiKey: process.env.GROQ_API_KEY || '',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  databaseUrl: process.env.DATABASE_URL || 'file:./dev.db',
  jwtSecret,
};
