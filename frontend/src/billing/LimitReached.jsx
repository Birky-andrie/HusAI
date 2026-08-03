import { Link } from 'react-router-dom';

/**
 * Shown after a call that ran past the free allowance.
 *
 * The distinction this screen has to carry is that **nothing was lost**: the
 * call saved, the transcript is readable in History, and only the AI review is
 * gated. A user who thinks their call vanished will not upgrade — they will
 * stop trusting the product.
 */
export default function LimitReached({ message, meetingId, onClose }) {
  return (
    <div className="review-panel">
      <span className="pro-lock-badge">PRO</span>
      <h3>Your call is saved — the review needs Pro</h3>

      <p>{message}</p>
      <p className="list-sub">
        Nothing was lost. The full transcript of this call is in your history; what needs Pro is the
        AI review and coaching for it.
      </p>

      <div className="review-actions">
        <Link className="primary" to="/plans">
          See Pro plans
        </Link>
        {meetingId && (
          <Link className="secondary" to={`/history/${meetingId}`}>
            View the transcript
          </Link>
        )}
        <button className="secondary" type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
