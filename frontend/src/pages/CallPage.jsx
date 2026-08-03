import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import CallView from '../components/CallView.jsx';
import ReviewDashboard from '../components/ReviewDashboard.jsx';
import UsageMeter from '../billing/UsageMeter.jsx';
import LimitReached from '../billing/LimitReached.jsx';
import { useUsage } from '../billing/useUsage.js';
import { useCallSession } from '../call/CallSessionContext.jsx';

/**
 * Thin view over CallSessionProvider — the actual mic/tab-audio capture,
 * transcription, Lifeline, and PiP live at the app-shell level (see
 * CallSessionContext) so the call survives navigating to other pages. This
 * component only renders the controls/transcript for the /call route itself.
 */
export default function CallPage() {
  const navigate = useNavigate();
  const call = useCallSession();
  const { status, refresh } = useUsage();

  // A finished call changes the allowance, so the meter is re-read once the
  // review lands rather than showing a stale count until the next navigation.
  useEffect(() => {
    if (call.savedMeetingId) refresh();
  }, [call.savedMeetingId, refresh]);

  // Free users out of allowance are stopped at the button. This is a courtesy,
  // not the enforcement — the server rejects the call regardless of what the
  // client renders.
  const outOfAllowance = status ? !status.canStartCall : false;

  return (
    <>
      {status && !call.callActive && <UsageMeter status={status} />}

      <CallView
        callActive={call.callActive}
        starting={call.starting}
        isDesktop={call.isDesktop}
        micError={call.micError}
        transcriptionUnavailable={call.transcriptionUnavailable}
        lines={call.lines}
        interim={call.interim}
        clientShare={call.clientShare}
        floatingCoach={call.floatingCoach}
        conversationMode={call.conversationMode}
        onToggleConversationMode={call.toggleConversationMode}
        onStartCall={call.startCall}
        onEndCall={call.endCall}
        onBack={() => navigate('/')}
        muted={call.muted}
        onToggleMute={call.toggleMute}
        startDisabled={outOfAllowance}
        startDisabledReason={
          outOfAllowance
            ? status?.blockedBy === 'calls'
              ? "You've used all your free calls this month."
              : "You've used all your free call minutes this month."
            : ''
        }
      />

      {call.showReview &&
        (call.limitReached ? (
          // The call was still saved — this is an upgrade prompt, not an error,
          // so it must not look like the review failed.
          <LimitReached
            message={call.limitReached.message}
            meetingId={call.savedMeetingId}
            onClose={call.closeReview}
          />
        ) : (
          <ReviewDashboard
            review={call.review}
            loading={call.reviewLoading}
            error={call.reviewError}
            onRetry={call.retryReview}
            onClose={call.closeReview}
            meetingId={call.savedMeetingId}
          />
        ))}
    </>
  );
}
