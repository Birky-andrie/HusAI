/**
 * Notification model + derivation. There is no backend notification table yet,
 * so instead of faking one, notifications are DERIVED from real data the
 * dashboard already loads (meetings, recommendations, progress). Each carries a
 * stable id so read-state (localStorage) survives reloads; when a backend
 * notifications API lands, only `deriveNotifications` needs replacing — the
 * bell component consumes the same shape either way.
 *
 * Shape: { id, type, title, body, at: epoch-ms, action?: { label, to } }
 * Types: 'review' | 'practice' | 'milestone' | 'insight' | 'system'
 */

const READ_KEY = 'husai.notifications.read';
const MAX_READ_IDS = 100; // cap localStorage growth; older ids age out with their notifications

export function getReadIds() {
  try {
    const raw = JSON.parse(localStorage.getItem(READ_KEY));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function markRead(ids) {
  const merged = [...new Set([...getReadIds(), ...ids])].slice(-MAX_READ_IDS);
  try {
    localStorage.setItem(READ_KEY, JSON.stringify(merged));
  } catch {
    /* storage full/blocked — read-state just won't persist */
  }
  return merged;
}

/**
 * Build the notification list from dashboard data. Quiet by design: at most one
 * of each type, only for events that genuinely happened, newest first.
 * `data` = { meetings, recs, summary } (the DashboardPage payload).
 */
export function deriveNotifications({ meetings = [], recs = [], summary = null } = {}) {
  const items = [];

  // REVIEW READY — the most recent call that has a finished AI review.
  const reviewed = meetings.find((m) => m.overallScore !== null);
  if (reviewed) {
    items.push({
      id: `review-${reviewed.id}`,
      type: 'review',
      title: 'Your call review is ready',
      body: `The analysis from your call scored ${reviewed.overallScore}/100. See what stood out and what to sharpen.`,
      at: new Date(reviewed.startedAt).getTime(),
      action: { label: 'View Review', to: `/history/${reviewed.id}` },
    });
  }

  // PRACTICE RECOMMENDATION — HusAI's current top pick (rule-engine, real).
  const rec = recs[0];
  if (rec && reviewed) {
    items.push({
      id: `rec-${rec.id}-${reviewed.id}`, // re-arms when a newer call re-derives it
      type: 'practice',
      title: `Practice recommended: ${rec.title}`,
      body: rec.reason,
      at: new Date(reviewed.startedAt).getTime(),
      action: { label: 'Start Practice', to: '/practice' },
    });
  }

  // PROGRESS MILESTONE — a real improvement between the two most recent averages.
  if (summary?.scores) {
    const best = summary.scores
      .map((s) => ({
        dimension: s.dimension,
        delta: s.current !== null && s.previous !== null ? Math.round((s.current - s.previous) * 10) / 10 : null,
      }))
      .filter((s) => s.delta !== null && s.delta >= 2)
      .sort((a, b) => b.delta - a.delta)[0];
    if (best) {
      const name = best.dimension.charAt(0).toUpperCase() + best.dimension.slice(1);
      items.push({
        id: `milestone-${best.dimension}-${Math.round(best.delta)}`,
        type: 'milestone',
        title: `${name} is up ${best.delta} points`,
        body: `Your ${best.dimension} score improved versus your previous calls. Keep the streak going.`,
        at: reviewed ? new Date(reviewed.startedAt).getTime() : Date.now(),
        action: { label: 'View Progress', to: '/progress' },
      });
    }
  }

  return items.sort((a, b) => b.at - a.at);
}
