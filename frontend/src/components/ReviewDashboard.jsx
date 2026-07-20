import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';

function ScoreStrip({ overallScore, scores }) {
  if (!scores) return null;
  const items = [
    ['Overall', overallScore],
    ['Confidence', scores.confidence],
    ['Clarity', scores.clarity],
    ['Conciseness', scores.conciseness],
    ['Professionalism', scores.professionalism],
  ];
  return (
    <div className="score-strip">
      {items.map(([label, value]) => (
        <div className={`score-tile${label === 'Overall' ? ' overall' : ''}`} key={label}>
          <span className="score-value">{value ?? '—'}</span>
          <span className="score-label">{label}</span>
        </div>
      ))}
    </div>
  );
}

export default function ReviewDashboard({ review, loading, error, onRetry, onClose }) {
  const navigate = useNavigate();
  const [startingPractice, setStartingPractice] = useState(false);

  const startPractice = async () => {
    if (!review?.id || startingPractice) return;
    setStartingPractice(true);
    try {
      const { session } = await api.post('/api/practice/sessions', { reviewId: review.id });
      navigate(`/practice/${session.id}`);
    } catch (err) {
      console.warn('practice start failed:', err.message);
      setStartingPractice(false);
    }
  };

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

      <ScoreStrip overallScore={review.overallScore} scores={review.scores} />

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

      {review.id && (
        <div className="review-actions">
          <button className="primary" onClick={startPractice} disabled={startingPractice}>
            {startingPractice ? 'Setting up your roleplay…' : '🎯 Practice these patterns now'}
          </button>
        </div>
      )}
    </div>
  );
}
