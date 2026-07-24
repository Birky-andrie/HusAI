import { useNavigate } from 'react-router-dom';
import CallView from '../components/CallView.jsx';
import ReviewDashboard from '../components/ReviewDashboard.jsx';
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

  return (
    <>
      <CallView
        callActive={call.callActive}
        isDesktop={call.isDesktop}
        micError={call.micError}
        transcriptionUnavailable={call.transcriptionUnavailable}
        lines={call.lines}
        interim={call.interim}
        clientShare={call.clientShare}
        floatingCoach={call.floatingCoach}
        onStartCall={call.startCall}
        onEndCall={call.endCall}
        onBack={() => navigate('/')}
      />

      {call.showReview && (
        <ReviewDashboard
          review={call.review}
          loading={call.reviewLoading}
          error={call.reviewError}
          onRetry={call.retryReview}
          onClose={call.closeReview}
          meetingId={call.savedMeetingId}
        />
      )}
    </>
  );
}
