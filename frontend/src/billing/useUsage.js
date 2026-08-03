import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api.js';

/**
 * Current plan + this month's usage, from GET /api/me/usage.
 *
 * DISPLAY AND PRE-FLIGHT ONLY. The server enforces limits regardless of what
 * this returns — this exists so a free user is stopped at the "Start call"
 * button instead of after they have already spoken to a real client, which is
 * a UX concern, not a security boundary.
 *
 * Shape:
 *   { entitlements, usage: { callsUsed, minutesUsed, periodStart, periodEnd },
 *     limits: { callsPerMonth, minutesPerMonth },
 *     callsRemaining, minutesRemaining, canStartCall, blockedBy }
 * `null` limits/remaining mean unlimited.
 */
export function useUsage() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setStatus(await api.get('/api/me/usage'));
      setError('');
    } catch (err) {
      setError(err.message || 'Could not load your plan usage.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { status, loading, error, refresh };
}

/** True when this plan has no quota at all. */
export function isUnlimited(status) {
  return status?.limits?.callsPerMonth === null && status?.limits?.minutesPerMonth === null;
}

/** "2 of 3 calls left · 18 of 30 minutes left", or '' when unlimited. */
export function usageSummary(status) {
  if (!status || isUnlimited(status)) return '';
  const parts = [];
  if (status.limits.callsPerMonth !== null) {
    parts.push(`${status.callsRemaining} of ${status.limits.callsPerMonth} calls left`);
  }
  if (status.limits.minutesPerMonth !== null) {
    parts.push(`${status.minutesRemaining} of ${status.limits.minutesPerMonth} minutes left`);
  }
  return parts.join(' · ');
}

/** When the allowance rolls over, e.g. "1 August". */
export function resetsOn(status) {
  if (!status?.usage?.periodEnd) return '';
  try {
    return new Date(status.usage.periodEnd).toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
  } catch {
    return '';
  }
}
