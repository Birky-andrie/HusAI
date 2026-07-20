const PILLARS = [
  {
    key: 'listen',
    title: 'Listen',
    lead: 'Live dual-channel transcription',
    body: 'HusAI hears both sides of the call — your voice and your client’s — transcribed live and kept separate, so every insight knows exactly who said what.',
  },
  {
    key: 'coach',
    title: 'Coach',
    lead: 'The Lifeline, when you need it',
    body: 'Frozen mid-call? After a few seconds of silence, three ready-to-say suggestions appear — confident, warm, and grounded in what was just said. Your client never notices.',
  },
  {
    key: 'train',
    title: 'Train',
    lead: 'A review after every call',
    body: 'Each call becomes a personal coaching session: the patterns holding you back — over-apologizing, hedging, burying the lead — plus roleplay exercises built from your own conversation.',
  },
];

export default function LandingPage({ onStart, startDisabled }) {
  return (
    <div className="landing">
      <section className="landing-hero">
        <p className="landing-eyebrow">For Filipino virtual assistants working with international clients</p>
        <h2 className="landing-headline">
          Speak with <em>husay</em>.
        </h2>
        <p className="landing-sub">
          {'“Husay”'} means skill, mastery, finesse. HusAI is your live call coach — it listens with you,
          steps in only when you need it, and turns every client call into training.
        </p>
        <button className="primary landing-cta" onClick={onStart} disabled={startDisabled}>
          Start a coaching session
        </button>
        <p className="landing-cta-note">Works in Chrome and Edge. Your coach, not your client&apos;s — only you are ever reviewed.</p>
      </section>

      <section className="landing-pillars">
        {PILLARS.map((pillar, i) => (
          <article className="pillar-card" key={pillar.key}>
            <span className="pillar-index">{String(i + 1).padStart(2, '0')}</span>
            <h3>{pillar.title}</h3>
            <p className="pillar-lead">{pillar.lead}</p>
            <p className="pillar-body">{pillar.body}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
