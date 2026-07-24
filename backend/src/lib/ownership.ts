import type { Response } from 'express';

/**
 * IDOR guard. Runs a finder that MUST already scope the query to the owner
 * (e.g. `where: { id, userId }`); if it returns nothing, sends a 404 and returns
 * null so the caller can `return`. 404 rather than 403 so we never reveal that
 * an id exists but belongs to someone else.
 *
 *   const meeting = await ownedOr404(res, () =>
 *     prisma.meeting.findFirst({ where: { id: req.params.id, userId: req.user!.id } }));
 *   if (!meeting) return;
 *
 * This centralizes the "fetch-owned-or-404" pattern so every resource-by-id
 * route stays IDOR-safe. Defense in depth on top of RLS at the database layer.
 */
export async function ownedOr404<T>(res: Response, finder: () => Promise<T | null>): Promise<T | null> {
  const row = await finder();
  if (!row) {
    res.status(404).json({ error: 'not-found' });
    return null;
  }
  return row;
}
