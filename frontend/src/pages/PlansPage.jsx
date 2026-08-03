import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { isPro, planLabel, intervalLabel, statusNote } from '../billing/plan.js';

const s = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' };
const ICheck = () => (<svg {...s}><path d="M20 6 9 17l-5-5" /></svg>);

/**
 * Plans / pricing. Every amount shown here comes from GET /api/billing/plans,
 * which reads it from Stripe — nothing about pricing is hard-coded in the
 * frontend, so changing a price in the Stripe dashboard changes this page.
 */
export default function PlansPage() {
  const { account, refreshMe } = useAuth();
  const location = useLocation();
  const subscription = account?.subscription;

  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busyPriceId, setBusyPriceId] = useState('');
  const [interval, setInterval] = useState('month');

  const checkoutResult = new URLSearchParams(location.search).get('checkout');
  const cancelled = checkoutResult === 'cancelled';
  const succeeded = checkoutResult === 'success';

  useEffect(() => {
    api
      .get('/api/billing/plans')
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  // Stripe redirects back the instant payment clears, which can beat its own
  // webhook to our database. Re-reading /api/me here means the page shows the
  // new plan rather than still claiming they are on Free.
  useEffect(() => {
    if (succeeded) refreshMe();
  }, [succeeded, refreshMe]);

  // Only offer the monthly/yearly switch when both are actually configured.
  const intervals = useMemo(() => {
    const found = new Set();
    (data?.plans || []).forEach((p) => p.prices.forEach((pr) => pr.interval && found.add(pr.interval)));
    return ['month', 'year'].filter((i) => found.has(i));
  }, [data]);

  useEffect(() => {
    if (intervals.length && !intervals.includes(interval)) setInterval(intervals[0]);
  }, [intervals, interval]);

  const startCheckout = async (priceId) => {
    setError('');
    setBusyPriceId(priceId);
    try {
      const { url } = await api.post('/api/billing/checkout', { priceId });
      window.location.href = url; // hand off to Stripe Checkout
    } catch (err) {
      setError(err.message || 'Could not start checkout. Please try again.');
      setBusyPriceId('');
    }
  };

  const openPortal = async () => {
    setError('');
    setBusyPriceId('portal');
    try {
      const { url } = await api.post('/api/billing/portal', {});
      window.location.href = url;
    } catch (err) {
      setError(err.message || 'Could not open the billing portal.');
      setBusyPriceId('');
    }
  };

  if (error && !data) return <div className="banner error">{error}</div>;
  if (!data)
    return (
      <div className="page-loading">
        <div className="spinner" />
      </div>
    );

  const subscribed = isPro(subscription);

  return (
    <div className="page plans-page">
      <div className="page-header">
        <div>
          <h2>Plans</h2>
          <p className="list-sub">
            {subscribed ? statusNote(subscription) : 'Choose the plan that fits how you want to improve.'}
          </p>
        </div>
      </div>

      {/* `info`, not a new success variant: the design system deliberately
          defines only danger and warning as semantic colours. */}
      {succeeded && (
        <div className="banner info">
          You&apos;re on Pro — thank you. Your receipt is on its way by email. Use{' '}
          <strong>Manage Plan</strong> below to update your payment method, see invoices, or cancel.
        </div>
      )}
      {cancelled && <div className="banner info">Checkout cancelled — no changes were made to your plan.</div>}
      {error && <div className="banner error">{error}</div>}

      {!data.configured && (
        <div className="banner info">
          Paid plans aren&apos;t available just yet. Everything in HusAI is free while we finish setting them up.
        </div>
      )}

      {intervals.length > 1 && (
        <div className="plan-interval" role="radiogroup" aria-label="Billing interval">
          {intervals.map((i) => (
            <button
              key={i}
              role="radio"
              aria-checked={interval === i}
              className={`plan-interval-option${interval === i ? ' selected' : ''}`}
              onClick={() => setInterval(i)}
            >
              {i === 'month' ? 'Monthly' : 'Yearly'}
            </button>
          ))}
        </div>
      )}

      <div className="plan-grid">
        {data.plans.map((plan) => {
          const price = plan.prices.find((p) => p.interval === interval) || plan.prices[0];
          const isFreeTier = plan.id === 'free';
          const isCurrent = isFreeTier ? !subscribed : subscribed;

          return (
            <section key={plan.id} className={`plan-card${plan.id === 'pro' ? ' featured' : ''}`}>
              {plan.id === 'pro' && <span className="plan-badge">Recommended</span>}
              <h3 className="plan-name">{plan.name}</h3>
              <p className="plan-tagline">{plan.tagline}</p>

              <div className="plan-price">
                {isFreeTier ? (
                  <span className="plan-amount">Free</span>
                ) : price?.display ? (
                  <>
                    <span className="plan-amount">{price.display}</span>
                    <span className="plan-interval-label">{intervalLabel(price.interval)}</span>
                  </>
                ) : (
                  <span className="plan-amount-tbd">Pricing coming soon</span>
                )}
              </div>

              <ul className="plan-features">
                {plan.features.map((f) => (
                  <li key={f}>
                    <span className="plan-check"><ICheck /></span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <div className="plan-cta">
                {isCurrent ? (
                  <button className="secondary" disabled>
                    Current Plan
                  </button>
                ) : isFreeTier ? (
                  <button className="secondary" onClick={openPortal} disabled={busyPriceId === 'portal'}>
                    {busyPriceId === 'portal' ? 'Opening…' : 'Manage Plan'}
                  </button>
                ) : subscribed ? (
                  <button className="primary" onClick={openPortal} disabled={busyPriceId === 'portal'}>
                    {busyPriceId === 'portal' ? 'Opening…' : 'Manage Plan'}
                  </button>
                ) : (
                  <button
                    className="primary"
                    onClick={() => startCheckout(price.priceId)}
                    disabled={!plan.purchasable || !price || Boolean(busyPriceId)}
                  >
                    {busyPriceId === price?.priceId ? 'Redirecting…' : 'Choose Plan'}
                  </button>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {subscribed && (
        <p className="list-sub plans-foot">
          You&apos;re on {planLabel(subscription)}. Manage payment method, invoices, or cancellation in the billing
          portal. <button className="link-inline" onClick={openPortal}>Open billing portal</button>
        </p>
      )}

      {/* Returning from a plan change should reflect immediately. */}
      {subscribed && <RefreshOnMount refresh={refreshMe} />}
    </div>
  );
}

/** Pulls fresh account state once, so a just-changed plan isn't shown stale. */
function RefreshOnMount({ refresh }) {
  useEffect(() => {
    refresh?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
