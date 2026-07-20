import 'dotenv/config';
import crypto from 'node:crypto';

// Missing JWT_SECRET falls back to a per-boot random secret: auth still works in
// dev, but every restart invalidates tokens — loud warning instead of a footgun.
const jwtSecret = process.env.JWT_SECRET || crypto.randomBytes(48).toString('base64url');
if (!process.env.JWT_SECRET) {
  console.warn('JWT_SECRET not set — using an ephemeral secret; sessions will not survive a restart.');
}

const port = Number(process.env.PORT || 3001);

export const config = {
  port,
  frontendOrigin: process.env.FRONTEND_ORIGIN || undefined,
  groqApiKey: process.env.GROQ_API_KEY || '',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  databaseUrl: process.env.DATABASE_URL || 'file:./dev.db',
  jwtSecret,

  // Where auth emails link back to (verify-email / reset-password pages).
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  // Public base URL of THIS backend — OAuth providers redirect here.
  apiBaseUrl: process.env.API_BASE_URL || `http://localhost:${port}`,

  // Email: console-logged links until RESEND_API_KEY is set.
  resendApiKey: process.env.RESEND_API_KEY || '',
  emailFrom: process.env.EMAIL_FROM || 'HusAI <onboarding@resend.dev>',

  // OAuth: a provider's buttons/routes activate only when both values are set.
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  msClientId: process.env.MS_CLIENT_ID || '',
  msClientSecret: process.env.MS_CLIENT_SECRET || '',
};
