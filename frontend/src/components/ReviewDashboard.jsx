export default function ReviewDashboard({ review, loading, error, onRetry, onClose }) {
  if (loading) {
    return (
      <div className="review-panel">
        <div className="review-loading">
          <div className="spinner" />
          <p>Analyzing your call… this can take a few seconds on longer calls.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="review-panel">
        <div className="review-error">
          <p>{error}</p>
          <button onClick={onRetry}>Try again</button>
          <button className="secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    );
  }

  if (!review) return null;

  return (
    <div className="review-panel">
      <div className="review-header">
        <h2>Call Review</h2>
        <button className="secondary" onClick={onClose}>
          Close
        </button>
      </div>

      <h3>What we noticed</h3>
      <div className="insight-list">
        {review.insights.map((insight, i) => (
          <div className="insight-card" key={i}>
            <div className="insight-pattern">{insight.pattern}</div>
            <blockquote>“{insight.evidence}”</blockquote>
            <p>{insight.explanation}</p>
          </div>
        ))}
      </div>

      <h3>Practice exercises</h3>
      <div className="exercise-list">
        {review.roleplayExercises.map((exercise, i) => (
          <div className="exercise-card" key={i}>
            <div className="exercise-title">🎭 {exercise.title}</div>
            <p>{exercise.scenario}</p>
            <div className="exercise-skill">Target skill: {exercise.targetSkill}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
