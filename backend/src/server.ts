import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import lifelineRouter from './modules/lifeline/routes.js';
import transcribeRouter from './modules/transcribe/routes.js';
import reviewRouter from './modules/review/routes.js';
import usersRouter from './modules/users/routes.js';
import meetingsRouter from './modules/meetings/routes.js';
import practiceRouter from './modules/practice/routes.js';
import progressRouter from './modules/progress/routes.js';
import billingRouter from './modules/billing/routes.js';
import billingWebhookRouter from './modules/billing/webhook.js';
import { quotaStatus } from './middleware/quotaGuard.js';
import { apiLimiter, aiLimiter } from './middleware/rateLimit.js';
import { attachWsHub, connectedClientCount } from './ws/hub.js';

const app = express();

// Render terminates TLS at its proxy and sets X-Forwarded-For. Trust exactly one
// hop so express-rate-limit keys off the real client IP (not the proxy's).
app.set('trust proxy', 1);

app.use(cors({ origin: config.frontendOrigin || true }));

// MUST precede express.json(): Stripe signs the raw request bytes, so the
// webhook needs an unparsed body (the router applies express.raw itself).
// Mounted above the rate limiter too, so Stripe's retry bursts are never
// throttled — same reasoning as the /api/health exemption below.
app.use('/api/billing/webhook', billingWebhookRouter);

// Desktop audio chunks arrive as base64 inside JSON — a 60s opus chunk is ~1MB raw, ~1.4MB encoded.
app.use(express.json({ limit: '25mb' }));

// Health check stays unthrottled (Render pings it) — declared before the limiter.
app.get('/api/health', (_req, res) => {
  const q = quotaStatus();
  res.json({
    status: 'ok',
    groqQuotaRemaining: q.groqChat,
    groqWhisperQuotaRemaining: q.groqWhisper,
    geminiQuotaRemaining: q.gemini,
    wsClients: connectedClientCount(),
  });
});

// Broad per-IP flood protection across every /api route below.
app.use('/api', apiLimiter);

// Expensive, unauthenticated AI endpoints get a tighter per-IP limit on top.
app.use('/api/lifeline', aiLimiter, lifelineRouter);
app.use('/api/transcribe', aiLimiter, transcribeRouter);
app.use('/api/review', aiLimiter, reviewRouter);
// Auth (sign-up/in, OAuth, password reset, email confirmation) is handled by
// Supabase Auth directly from the client; the backend only verifies tokens.
app.use('/api', usersRouter); // /api/me + settings
app.use('/api/meetings', meetingsRouter);
app.use('/api/practice', practiceRouter);
app.use('/api/progress', progressRouter);
app.use('/api/billing', billingRouter); // webhook is mounted separately, above

const server = http.createServer(app);
attachWsHub(server);

server.listen(config.port, () => {
  console.log(`HusAI backend listening on http://localhost:${config.port}`);
  if (!config.groqApiKey) console.warn('GROQ_API_KEY not set — lifeline/transcribe will return MOCK responses');
  if (!config.geminiApiKey) console.warn('GEMINI_API_KEY not set — review will return MOCK responses');
});
