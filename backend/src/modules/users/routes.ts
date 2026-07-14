import { Router } from 'express';
import { authRequired } from '../../middleware/auth.js';
import { getUserById } from '../auth/service.js';

const router = Router();

router.get('/me', authRequired, async (req, res) => {
  const user = await getUserById(req.user!.id);
  if (!user) {
    // Valid token but the user row is gone (deleted account).
    return res.status(401).json({ error: 'unauthorized' });
  }
  res.json({ user });
});

export default router;
