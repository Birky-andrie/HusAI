import 'dotenv/config';

const port = Number(process.env.PORT || 3001);

const databaseUrl = process.env.DATABASE_URL || '';
if (!databaseUrl) {
  console.warn(
    'DATABASE_URL not set — set your Supabase/Postgres connection string (Session pooler, port 5432) in backend/.env.',
  );
}

// Supabase Auth: the backend verifies Supabase-issued access tokens against the
// project's public JWKS, so no shared secret is needed. SUPABASE_URL is the
// project API URL, e.g. https://<ref>.supabase.co.
const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
if (!supabaseUrl) {
  console.warn('SUPABASE_URL not set — auth token verification will reject every request.');
}

export const config = {
  port,
  frontendOrigin: process.env.FRONTEND_ORIGIN || undefined,
  groqApiKey: process.env.GROQ_API_KEY || '',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  databaseUrl,
  supabaseUrl,
  // Only needed for hard-deleting the Supabase auth user on account deletion.
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',

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

  // Billing (Stripe). Every value is optional: with no secret key the billing
  // routes report "not configured" and the rest of the app is untouched.
  //
  // NOTE: prices are deliberately NOT defined here. Only Price *IDs* are
  // configured; the actual amount/currency/interval is read from Stripe at
  // request time, so final pricing is set in the Stripe dashboard with no code
  // change. Add more tiers by adding more price-id vars + entries in plans.ts.
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  stripePriceProMonthly: process.env.STRIPE_PRICE_PRO_MONTHLY || '',
  stripePriceProYearly: process.env.STRIPE_PRICE_PRO_YEARLY || '',
  // 0 / unset = no free trial. Applied to new subscriptions only.
  stripeTrialDays: Number(process.env.STRIPE_TRIAL_DAYS || 0),
};
