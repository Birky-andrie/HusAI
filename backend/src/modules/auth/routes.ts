import { Router } from 'express';
import {
  register,
  login,
  refreshSession,
  logout,
  verifyEmail,
  resendVerification,
  requestPasswordReset,
  resetPassword,
  changePassword,
  AuthError,
} from './service.js';
import oauthRouter, { enabledProviders } from './oauth.js';
import { authRequired } from '../../middleware/auth.js';

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
    res.status(201).json(await register(email, password, displayName));
  } catch (err) {
    handleAuthError(err, res);
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = (req.body || {}) as Record<string, unknown>;
  try {
    res.json(await login(email, password));
  } catch (err) {
    handleAuthError(err, res);
  }
});

router.post('/refresh', async (req, res) => {
  try {
    res.json(await refreshSession((req.body || {}).refreshToken));
  } catch (err) {
    handleAuthError(err, res);
  }
});

router.post('/logout', async (req, res) => {
  await logout((req.body || {}).refreshToken);
  res.json({ ok: true });
});

router.post('/verify-email', async (req, res) => {
  try {
    res.json({ user: await verifyEmail((req.body || {}).token) });
  } catch (err) {
    handleAuthError(err, res);
  }
});

router.post('/resend-verification', authRequired, async (req, res) => {
  try {
    await resendVerification(req.user!.id);
    res.json({ ok: true });
  } catch (err) {
    handleAuthError(err, res);
  }
});

router.post('/request-password-reset', async (req, res) => {
  await requestPasswordReset((req.body || {}).email);
  res.json({ ok: true }); // always — never reveal whether the email exists
});

router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = (req.body || {}) as Record<string, unknown>;
  try {
    await resetPassword(token, newPassword);
    res.json({ ok: true });
  } catch (err) {
    handleAuthError(err, res);
  }
});

router.post('/change-password', authRequired, async (req, res) => {
  const { currentPassword, newPassword } = (req.body || {}) as Record<string, unknown>;
  try {
    await changePassword(req.user!.id, currentPassword, newPassword);
    res.json({ ok: true, message: 'Password changed. Other devices were signed out.' });
  } catch (err) {
    handleAuthError(err, res);
  }
});

// Which sign-in buttons the frontend should render.
router.get('/providers', (_req, res) => {
  res.json({ providers: enabledProviders() });
});

router.use('/oauth', oauthRouter);

export default router;
