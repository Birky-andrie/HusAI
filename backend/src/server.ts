import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import lifelineRouter from './modules/lifeline/routes.js';
import transcribeRouter from './modules/transcribe/routes.js';
import reviewRouter from './modules/review/routes.js';
import authRouter from './modules/auth/routes.js';
import usersRouter from './modules/users/routes.js';
import { quotaStatus } from './middleware/quotaGuard.js';
import { attachWsHub, connectedClientCount } from './ws/hub.js';

const app = express();

app.use(cors({ origin: config.frontendOrigin || true }));
// Desktop audio chunks arrive as base64 inside JSON — a 60s opus chunk is ~1MB raw, ~1.4MB encoded.
app.use(express.json({ limit: '25mb' }));

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

app.use('/api/lifeline', lifelineRouter);
app.use('/api/transcribe', transcribeRouter);
app.use('/api/review', reviewRouter);
app.use('/api/auth', authRouter);
app.use('/api', usersRouter); // GET /api/me

const server = http.createServer(app);
attachWsHub(server);

server.listen(config.port, () => {
  console.log(`HusAI backend listening on http://localhost:${config.port}`);
  if (!config.groqApiKey) console.warn('GROQ_API_KEY not set — lifeline/transcribe will return MOCK responses');
  if (!config.geminiApiKey) console.warn('GEMINI_API_KEY not set — review will return MOCK responses');
});
