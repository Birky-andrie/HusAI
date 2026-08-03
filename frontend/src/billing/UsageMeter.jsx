import { Link } from 'react-router-dom';
import { isUnlimited, resetsOn } from './useUsage.js';

/**
 * What is left of this month's free allowance.
 *
 * Renders nothing on an unlimited plan — a Pro user does not need to be
 * reminded they have no limits, and an empty meter reading "∞ of ∞" is noise.
 */
export default function UsageMeter({ status }) {
  if (!status || isUnlimited(status)) return null;

  const { limits, callsRemaining, minutesRemaining, usage } = status;
  const spent = !status.canStartCall;
  const resets = resetsOn(status);

  // The bar tracks whichever allowance is closest to running out — that is the
  // one that will actually stop them, so showing the more comfortable number
  // would be misleading.
  const callPct = limits.callsPerMonth ? usage.callsUsed / limits.callsPerMonth : 0;
  const minutePct = limits.minutesPerMonth ? usage.minutesUsed / limits.minutesPerMonth : 0;
  const pct = Math.min(100, Math.round(Math.max(callPct, minutePct) * 100));

  return (
    <div className="usage-meter">
      <div className="usage-meter-head">
        <span>
          {limits.callsPerMonth !== null && (
            <>
              <strong>{callsRemaining}</strong> of {limits.callsPerMonth} calls
            </>
          )}
          {limits.callsPerMonth !== null && limits.minutesPerMonth !== null && ' · '}
          {limits.minutesPerMonth !== null && (
            <>
              <strong>{minutesRemaining}</strong> of {limits.minutesPerMonth} minutes
            </>
          )}
        </span>
        {resets && <span className="usage-meter-reset">Resets {resets}</span>}
      </div>

      <div
        className="usage-bar"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Free plan usage this month"
      >
        <div className={`usage-bar-fill${spent ? ' spent' : ''}`} style={{ width: `${pct}%` }} />
      </div>

      {spent && (
        <p className="usage-meter-empty">
          {status.blockedBy === 'calls'
            ? "You've used all your free calls this month."
            : "You've used all your free call minutes this month."}{' '}
          <Link to="/plans">Upgrade to Pro</Link> for unlimited calls
          {resets ? `, or wait until ${resets}.` : '.'}
        </p>
      )}
    </div>
  );
}
