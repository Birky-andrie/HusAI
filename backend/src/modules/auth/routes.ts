import { Router } from 'express';
import { register, login, AuthError } from './service.js';

const router = Router();

function handleAuthError(err: unknown, res: import('express').Response): void {
  if (err instanceof AuthError) {
    res.status(err.status).json({ error: err.code, message: err.message });
    return;
  }
  console.error('auth error:', (err as Error).message);
  res.status(500).json({ error: 'auth-failed', message: 'Something went wrong. Please try again.' });
}

router.post('/register', async (req, res) => {
  const { email, password, displayName } = (req.body || {}) as Record<string, unknown>;
  try {
    const result = await register(email, password, displayName);
    res.status(201).json(result);
  } catch (err) {
    handleAuthError(err, res);
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = (req.body || {}) as Record<string, unknown>;
  try {
    const result = await login(email, password);
    res.json(result);
  } catch (err) {
    handleAuthError(err, res);
  }
});

export default router;
