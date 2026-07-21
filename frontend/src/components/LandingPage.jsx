import { useNavigate } from 'react-router-dom';
import Logo from './Logo.jsx';

/* ---- tiny inline glyphs (stroke, currentColor) ---- */
const g = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' };
const GPlay = () => (<svg {...g}><path d="M8 5v14l11-7z" /></svg>);
const GEar = () => (<svg {...g}><path d="M6 8a6 6 0 0 1 12 0c0 3-2 4-2 7a4 4 0 0 1-8 0" /><path d="M9 8a3 3 0 0 1 6 0" /></svg>);
const GBulb = () => (<svg {...g}><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10c1 1 1 2 1 3h6c0-1 0-2 1-3a6 6 0 0 0-4-10Z" /></svg>);
const GChart = () => (<svg {...g}><path d="M3 3v18h18" /><path d="M7 14l4-4 3 3 5-6" /></svg>);
const GShield = () => (<svg {...g}><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M9 12l2 2 4-4" /></svg>);
const GMic = () => (<svg {...g}><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0M12 17v4" /></svg>);
const GLayers = () => (<svg {...g}><path d="M12 3l9 5-9 5-9-5z" /><path d="M3 13l9 5 9-5" /></svg>);
const GSpark = () => (<svg {...g}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" /></svg>);
const GCheck = () => (<svg {...g} width="18" height="18"><path d="M20 6 9 17l-5-5" /></svg>);

function SectionHead({ eyebrow, title, sub, center = true }) {
  return (
    <div className={`lp-head${center ? ' center' : ''}`}>
      {eyebrow && <span className="lp-eyebrow">{eyebrow}</span>}
      <h2>{title}</h2>
      {sub && <p className="lp-sub">{sub}</p>}
    </div>
  );
}

const PROBLEMS = [
  { icon: <GMic />, title: 'You freeze mid-call', body: 'The client asks something hard and your mind goes blank. The pause says more than any answer would.' },
  { icon: <GSpark />, title: 'You over-apologize & hedge', body: '“Sorry, maybe, I think…” — small words that quietly chip away at how seriously clients take you.' },
  { icon: <GChart />, title: 'You learn too late', body: 'The call ends, the moment is gone, and nobody ever shows you exactly what to do differently.' },
];

const STEPS = [
  { n: '01', icon: <GPlay />, title: 'Start Coach', body: 'Activate HusAI alongside Zoom, Google Meet, or Teams — no bots in the room.' },
  { n: '02', icon: <GEar />, title: 'AI Listens', body: 'Both you and your client are transcribed live and kept on separate channels.' },
  { n: '03', icon: <GBulb />, title: 'AI Suggests', body: 'Subtle, ready-to-say prompts appear the exact moment you need them.' },
  { n: '04', icon: <GChart />, title: 'Review', body: 'Post-call analytics on confidence, clarity, pacing, and filler words.' },
];

const FEATURES = [
  { icon: <GBulb />, title: 'The Lifeline', body: 'Go quiet for a few seconds and three confident, context-aware replies appear — your client never notices.' },
  { icon: <GLayers />, title: 'Dual-Channel Transcription', body: 'HusAI hears both sides of the call, labeled and separated, so every insight knows who said what.' },
  { icon: <GShield />, title: 'Confidence Coaching', body: 'Live signals on pace, filler words, and tonality keep you sounding assured under pressure.' },
  { icon: <GChart />, title: 'AI Review & Replay', body: 'Every call becomes a scored, searchable lesson with specific, personalized next steps.' },
];

const OUTCOMES = [
  { stat: 'Real-time', label: 'coaching, mid-conversation' },
  { stat: '2 channels', label: 'you and your client, never mixed' },
  { stat: '4 scores', label: 'confidence · clarity · conciseness · professionalism' },
  { stat: 'Every call', label: 'turned into personalized practice' },
];

const TESTIMONIALS = [
  { quote: 'The Lifeline pulled me out of a freeze on a discovery call. I sounded like I had it all planned.', name: 'Maria S.', role: 'Executive VA' },
  { quote: 'The post-call review finally showed me I was over-apologizing. Two weeks later, gone.', name: 'James C.', role: 'Client Success VA' },
  { quote: 'Practice sessions feel like the real thing. I walk into calls already warmed up.', name: 'Priya M.', role: 'Sales VA' },
];

const PLANS = [
  { name: 'Professional', tagline: 'For individuals', price: '$29', unit: '/mo', features: ['15 hours live coaching', 'Post-call reviews', 'Basic analytics', 'Email support'], cta: 'Choose Professional' },
  { name: 'Pro', tagline: 'For serious communicators', price: '$79', unit: '/mo', features: ['Unlimited live coaching', 'AI Review & Replay', 'Deep analytics & trends', 'Personalized practice', 'Priority support'], cta: 'Choose Pro', popular: true },
  { name: 'Enterprise', tagline: 'For teams', price: 'Custom', unit: '', features: ['Everything in Pro', 'Team dashboards', 'SSO & custom integrations', 'Dedicated success manager'], cta: 'Contact Sales' },
];

export default function LandingPage({ onStart, startDisabled }) {
  const navigate = useNavigate();
  const start = onStart || (() => navigate('/register'));
  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div className="lp">
      {/* Nav */}
      <header className="lp-nav">
        <div className="lp-nav-inner">
          <button className="lp-brand" onClick={() => scrollTo('lp-top')} aria-label="HusAI home">
            <Logo size={28} />
          </button>
          <nav className="lp-nav-links">
            <button onClick={() => scrollTo('how')}>How it works</button>
            <button onClick={() => scrollTo('features')}>Features</button>
            <button onClick={() => scrollTo('pricing')}>Pricing</button>
          </nav>
          <div className="lp-nav-actions">
            <button className="lp-link" onClick={() => navigate('/login')}>Sign in</button>
            <button className="primary" onClick={start} disabled={startDisabled}>Get Started</button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="lp-hero" id="lp-top">
        <div className="lp-hero-glow" aria-hidden="true" />
        <span className="lp-badge"><GSpark /> Live Communication Coach 2.0</span>
        <h1 className="lp-hero-title">
          Speak with <em>confidence.</em><br />Respond with <em>intelligence.</em>
        </h1>
        <p className="lp-hero-sub">
          The AI-powered live communication coach that helps Filipino virtual assistants master sales calls,
          interviews, and client meetings in real time — unobtrusive, intelligent, and always in your corner.
        </p>
        <div className="lp-hero-cta">
          <button className="primary" onClick={start} disabled={startDisabled}>Get Started Free</button>
          <button className="lp-ghost" onClick={() => scrollTo('how')}><GPlay /> Watch Demo</button>
        </div>
      </section>

      {/* Problem */}
      <section className="lp-section">
        <SectionHead eyebrow="The Problem" title="Every silence costs you credibility." sub="On a live client call, hesitation is loud. These are the moments that quietly hold VAs back." />
        <div className="lp-grid-3">
          {PROBLEMS.map((p) => (
            <article className="lp-card" key={p.title}>
              <span className="lp-icon">{p.icon}</span>
              <h3>{p.title}</h3>
              <p>{p.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Solution */}
      <section className="lp-section lp-alt">
        <div className="lp-split">
          <div className="lp-split-text">
            <SectionHead eyebrow="The Solution" title="Meet HusAI — your invisible strategist." center={false} />
            <p className="lp-body">
              HusAI listens alongside you, understands the conversation, and steps in only when it helps. It coaches you
              in the moment and trains you after — so you get sharper with every single call.
            </p>
            <ul className="lp-checks">
              <li><GCheck /> Listen — dual-channel, real-time transcription</li>
              <li><GCheck /> Coach — the Lifeline, exactly when you need it</li>
              <li><GCheck /> Train — a personalized review after every call</li>
            </ul>
          </div>
          <div className="lp-split-visual">
            <div className="lp-mock">
              <div className="lp-mock-head"><Logo size={22} /><span className="lp-mock-live">● LIVE</span></div>
              <div className="lp-mock-line client">Client: “…so how confident are you in hitting the revised Q3 numbers?”</div>
              <div className="lp-mock-insight"><GSpark /> HusAI Insight — detected hesitation. Suggested pivot below.</div>
              <div className="lp-mock-reply">“Let's break down the pipeline. What specific bottlenecks are we seeing?”</div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="lp-section" id="how">
        <SectionHead eyebrow="How it works" title="Four steps to absolute clarity." sub="From setup to mastery in one seamless flow." />
        <div className="lp-grid-4">
          {STEPS.map((s) => (
            <article className="lp-card lp-step" key={s.n}>
              <span className="lp-step-n">{s.n}</span>
              <span className="lp-icon">{s.icon}</span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Core features */}
      <section className="lp-section lp-alt" id="features">
        <SectionHead eyebrow="Core Features" title="Cognitive edge, on every call." sub="Everything you need to master any professional interaction." />
        <div className="lp-grid-2">
          {FEATURES.map((f) => (
            <article className="lp-card lp-feature" key={f.title}>
              <span className="lp-icon">{f.icon}</span>
              <div>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </div>
            </article>
          ))}
        </div>
        <div className="lp-measure">
          <div>
            <span className="lp-eyebrow light">Post-Call Analytics</span>
            <h3>Measure to master.</h3>
            <p>Comprehensive breakdowns of your communication metrics — track improvement over time and identify exactly where to practice.</p>
          </div>
          <div className="lp-bars" aria-hidden="true">
            {[40, 55, 48, 70, 62, 85, 92].map((h, i) => (
              <span key={i} style={{ height: `${h}%` }} className={h >= 85 ? 'peak' : ''} />
            ))}
          </div>
        </div>
      </section>

      {/* Practice */}
      <section className="lp-section">
        <div className="lp-split reverse">
          <div className="lp-split-text">
            <SectionHead eyebrow="Personalized Practice" title="Train like it's the real thing." center={false} />
            <p className="lp-body">
              Every weakness HusAI spots becomes a targeted roleplay. An AI client pushes back, asks the hard questions,
              and gets tougher as you improve — so the real call feels easy.
            </p>
            <div className="lp-chips">
              {['Discovery calls', 'Objection handling', 'Explaining delays', 'Difficult clients', 'Sales pitches'].map((c) => (
                <span className="lp-chip" key={c}>{c}</span>
              ))}
            </div>
          </div>
          <div className="lp-split-visual">
            <div className="lp-mock">
              <div className="lp-mock-line client">Client: “Honestly, the timeline seems aggressive for our bandwidth.”</div>
              <div className="lp-mock-reply you">You: “I hear you. What specific phase worries you most on bandwidth?”</div>
              <div className="lp-mock-feedback"><GCheck /> Strong active listening · reflected the concern back</div>
            </div>
          </div>
        </div>
      </section>

      {/* Outcomes */}
      <section className="lp-section lp-alt">
        <SectionHead eyebrow="Outcomes" title="Communicate like a top-tier VA." sub="Awareness, in the moment. Growth, over time." />
        <div className="lp-grid-4">
          {OUTCOMES.map((o) => (
            <div className="lp-outcome" key={o.label}>
              <span className="lp-outcome-stat">{o.stat}</span>
              <span className="lp-outcome-label">{o.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Social proof */}
      <section className="lp-section">
        <SectionHead eyebrow="Loved by VAs" title="Confidence, earned call after call." />
        <div className="lp-grid-3">
          {TESTIMONIALS.map((t) => (
            <figure className="lp-card lp-quote" key={t.name}>
              <blockquote>“{t.quote}”</blockquote>
              <figcaption>
                <strong>{t.name}</strong>
                <span>{t.role}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="lp-section lp-alt" id="pricing">
        <SectionHead eyebrow="Pricing" title="Invest in your voice." sub="Simple, transparent pricing for professionals." />
        <div className="lp-plans">
          {PLANS.map((p) => (
            <div className={`lp-plan${p.popular ? ' popular' : ''}`} key={p.name}>
              {p.popular && <span className="lp-plan-tag">Most Popular</span>}
              <h3>{p.name}</h3>
              <p className="lp-plan-tagline">{p.tagline}</p>
              <div className="lp-plan-price">
                <span>{p.price}</span>
                {p.unit && <small>{p.unit}</small>}
              </div>
              <ul>
                {p.features.map((f) => (<li key={f}><GCheck /> {f}</li>))}
              </ul>
              <button className={p.popular ? 'primary' : 'secondary'} onClick={start} style={{ width: '100%' }}>{p.cta}</button>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="lp-final">
        <div className="lp-final-inner">
          <h2>Ready to speak with confidence?</h2>
          <p>Join the VAs turning every client call into their sharpest yet.</p>
          <button className="primary" onClick={start} disabled={startDisabled}>Get Started Free</button>
        </div>
      </section>

      {/* Footer */}
      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <div className="lp-footer-brand">
            <Logo size={26} />
            <p>Your AI communication coach. Built for Filipino virtual assistants.</p>
          </div>
          <div className="lp-footer-links">
            <button onClick={() => scrollTo('features')}>Features</button>
            <button onClick={() => scrollTo('pricing')}>Pricing</button>
            <button onClick={() => navigate('/login')}>Sign in</button>
            <button onClick={start}>Get Started</button>
          </div>
        </div>
        <div className="lp-footer-legal">© {new Date().getFullYear()} HusAI. All rights reserved.</div>
      </footer>
    </div>
  );
}
