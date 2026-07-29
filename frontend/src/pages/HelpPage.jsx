import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { webSpeechSupported } from '../hooks/useWebSpeechTranscription.js';

const svg = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };
const IconChevron = () => (<svg {...svg} width="16" height="16"><path d="M6 9l6 6 6-6" /></svg>);
const IconSearch = () => (<svg {...svg} width="16" height="16"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>);

/**
 * The three steps that actually matter on a first call, in the order they
 * happen. Deliberately short — the detail lives in the topics below; this is
 * the "you are not lost" answer someone wants within two seconds of landing.
 */
const STEPS = [
  {
    title: 'Start the call in HusAI',
    body: 'Open Live Coach and hit Start Call, then allow the microphone. Keep your meeting running in its own window as usual.',
  },
  {
    title: 'Share your client’s audio',
    body: 'Click Share client audio, pick your meeting tab, and tick “Also share tab audio.” Without it, HusAI only hears your side.',
  },
  {
    title: 'Pause when you’re stuck',
    body: 'Go quiet for about four seconds and the Lifeline appears with up to three things you could say next. Copy one, or ignore it.',
  },
];

/**
 * Help content is plain strings (not JSX) on purpose: the search box below
 * filters on the answer text, which only works if the answer *is* text. Rich
 * formatting is traded for searchability — an optional `link` covers the one
 * case where an answer needs to send you somewhere.
 */
const TOPICS = [
  {
    group: 'Live calls & audio',
    items: [
      {
        q: 'When does the Lifeline actually appear?',
        a: [
          'It watches your microphone during a call. When you go quiet for about four seconds mid-conversation, it suggests up to three lines you could say next.',
          'Your client talking resets that timer, so you always get a full window after they finish rather than a suggestion the moment they stop.',
        ],
      },
      {
        q: 'Which browsers does HusAI support?',
        a: [
          'Chrome or Edge. Live transcription of your own voice and the floating coach window both rely on browser features that other browsers don’t have yet — in those, Start Call is disabled and a warning explains why.',
          'The desktop app has no such limit: it transcribes your microphone itself, so it works the same everywhere it’s installed.',
        ],
      },
      {
        q: 'How do I let HusAI hear my client?',
        a: [
          'Start the call first, then click “Share client audio.” Your browser asks which tab to share — choose the tab your meeting is running in, and make sure “Also share tab audio” is ticked before you confirm.',
          'That checkbox is the part people miss. Sharing a tab without its audio gives HusAI a picture and no sound, so your client’s side never reaches the transcript.',
        ],
      },
      {
        q: 'My microphone is blocked.',
        a: [
          'In the browser: click the microphone or lock icon in the address bar, allow the microphone for HusAI, then reload the page.',
          'On the desktop app: Windows — Settings → Privacy & security → Microphone. macOS — System Settings → Privacy & Security → Microphone. Restart HusAI afterwards so it picks up the new permission.',
        ],
        link: { to: '/settings', label: 'Test your microphone in Settings' },
      },
      {
        q: 'Can I keep the coach visible over Zoom or Meet?',
        a: [
          'Yes. During a call, click “Float the coach” — the coaching panel pops out into a small always-on-top window that stays visible while you work in your meeting app.',
          'On the desktop app, the HusAI window itself floats above your other windows instead, so there is nothing extra to pop out.',
        ],
      },
      {
        q: 'Why is everyone on my client’s side labelled “Client side”?',
        a: [
          'Shared tab audio arrives as a single channel, so HusAI can’t yet tell individual participants on that side apart. Everyone there is transcribed together as one voice.',
          'This is a known limitation, and the scoring accounts for it: long stretches where the client side is talking among themselves are excluded from your response-time metric, rather than counted as you being slow to answer.',
        ],
      },
      {
        q: 'What is Conversation Mode?',
        a: [
          'An optional mode for calls where several people on the client’s side are talking to each other. Instead of only coaching your silences, it suggests natural ways to join the discussion.',
          'The toggle appears under your capture chips once client audio is shared — there is no discussion to join before that.',
        ],
      },
      {
        q: 'Some of what I said is missing from the transcript.',
        a: [
          'If you’re on speakers rather than headphones, your client’s voice can leak into your microphone and land in the transcript as words you never said. HusAI drops lines that closely repeat what your client said at that same moment, so they don’t pollute your review.',
          'Nothing is lost when this happens — the words are still in the transcript under your client’s side. Headphones remove the problem entirely.',
        ],
      },
      {
        q: 'Does my call end if I open another page?',
        a: [
          'No. The call keeps running while you move around HusAI, and the sidebar shows a live status you can click to jump straight back to it.',
        ],
      },
    ],
  },
  {
    group: 'After the call',
    items: [
      {
        q: 'Where do I find my review?',
        a: [
          'It’s generated when you end the call, and it opens on the spot. Every past review — with the full transcript and the replay — lives in Reviews & Replay.',
          'If no speech was captured during a call, there is nothing to analyse and no review is created.',
        ],
        link: { to: '/history', label: 'Open Reviews & Replay' },
      },
      {
        q: 'My review failed to generate.',
        a: [
          'Reviews run on an external AI provider, and it occasionally rejects a request when it’s under load. HusAI retries automatically and falls back to a second provider before giving up.',
          'If it still fails, use the Retry button on the review itself — your transcript is already saved, so nothing is lost by trying again a minute later.',
        ],
      },
      {
        q: 'How does Practice work?',
        a: [
          'Practice is AI roleplay aimed at whatever your recent calls suggest is weakest. The recommendations on the Practice page come from your own reviews and trends, so they change as you improve.',
          'You can also work through a recommendation more than once — sessions are kept, so you can see how a second attempt compares.',
        ],
        link: { to: '/practice', label: 'Go to Practice' },
      },
    ],
  },
  {
    group: 'Account, plan & data',
    items: [
      {
        q: 'How do I change my plan?',
        a: [
          'Plans shows what’s available, and Settings has a link to the billing portal where you can update your payment method, download invoices, or cancel.',
          'Cancelling takes effect at the end of the period you’ve already paid for — you keep access until then.',
        ],
        link: { to: '/plans', label: 'View plans' },
      },
      {
        q: 'What does HusAI store about my calls?',
        a: [
          'Your profile, call history, transcripts, reviews, practice sessions, and progress. That’s what makes the review, the replay, and the trend charts possible.',
          'Deleting your account removes all of it permanently — profile, transcripts, reviews, practice, progress. It cannot be undone.',
        ],
        link: { to: '/settings', label: 'Manage or delete your account' },
      },
      {
        q: 'How do I change the theme or my notification preferences?',
        a: [
          'Both live in Settings. The theme follows your operating system by default and can be pinned to light or dark per device.',
          'Notification emails aren’t sending yet — your preferences are saved now and will apply as soon as they ship.',
        ],
        link: { to: '/settings', label: 'Open Settings' },
      },
    ],
  },
];

// Set VITE_SUPPORT_EMAIL to turn the contact card into a real mailto. Left
// unset, the card stays honest about there being no inbox yet rather than
// advertising an address that would bounce.
const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || '';

function matches(item, needle) {
  if (!needle) return true;
  return (item.q + ' ' + item.a.join(' ')).toLowerCase().includes(needle);
}

/**
 * Diagnostics for the two failures that generate the most confusion: a browser
 * that can't transcribe, and a browser that can't float the coach. Showing the
 * answer for *this* browser beats making someone match themselves against a
 * compatibility table.
 */
function SetupCheck() {
  const isDesktop = Boolean(window.electronAPI?.isDesktop);
  const [micMsg, setMicMsg] = useState('');
  const [micBusy, setMicBusy] = useState(false);

  const testMic = async () => {
    setMicMsg('');
    setMicBusy(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setMicMsg('Microphone works and permission is granted.');
    } catch {
      setMicMsg(
        isDesktop
          ? 'Microphone blocked. Windows: Settings → Privacy & security → Microphone. macOS: System Settings → Privacy & Security → Microphone.'
          : 'Microphone blocked. Click the microphone or lock icon in the address bar, allow it, then reload.'
      );
    } finally {
      setMicBusy(false);
    }
  };

  const checks = [
    {
      label: 'Live transcription',
      ok: isDesktop || webSpeechSupported,
      note: isDesktop
        ? 'Handled by the desktop app.'
        : webSpeechSupported
          ? 'Supported in this browser.'
          : 'Not available here — use Chrome or Edge.',
    },
    {
      label: 'Floating coach',
      ok: isDesktop || (typeof window !== 'undefined' && 'documentPictureInPicture' in window),
      note: isDesktop
        ? 'The desktop window floats on its own.'
        : 'documentPictureInPicture' in window
          ? 'Supported in this browser.'
          : 'Not available here — use Chrome or Edge.',
    },
  ];

  return (
    <div className="help-check">
      {checks.map((c) => (
        <div className="help-check-row" key={c.label}>
          <span className={`help-check-dot${c.ok ? '' : ' warn'}`} aria-hidden="true" />
          <span className="help-check-label">{c.label}</span>
          <span className="list-sub">{c.note}</span>
        </div>
      ))}
      <div className="settings-actions help-check-actions">
        <button className="secondary" onClick={testMic} disabled={micBusy} aria-busy={micBusy}>
          {micBusy ? 'Checking…' : 'Test microphone access'}
        </button>
        {micMsg && <span className="list-sub">{micMsg}</span>}
      </div>
    </div>
  );
}

export default function HelpPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return TOPICS.map((g) => ({ ...g, items: g.items.filter((i) => matches(i, needle)) })).filter(
      (g) => g.items.length > 0
    );
  }, [query]);

  const searching = query.trim().length > 0;

  return (
    <div className="page help-page">
      <div className="page-header">
        <div>
          <h2>Help &amp; Support</h2>
          <p className="list-sub">Everything about running a call, reading your review, and looking after your account.</p>
        </div>
      </div>

      <section className="help-start">
        <h3 className="section-title">Start here</h3>
        <ol className="help-steps">
          {STEPS.map((step, i) => (
            <li className="help-step" key={step.title}>
              <span className="help-step-num" aria-hidden="true">{i + 1}</span>
              <div>
                <p className="help-step-title">{step.title}</p>
                <p className="list-sub">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
        {/* The page's single full-strength accent, per the Once-Per-Page Rule.
            A <button> rather than a <Link> because the primary treatment is
            scoped to button.primary — reusing it beats duplicating the recipe. */}
        <button className="primary help-start-cta" onClick={() => navigate('/call')}>
          Start a Call
        </button>
      </section>

      <div className="help-topics-head">
        <h3 className="section-title">Browse topics</h3>
        <label className="help-search">
          <span className="help-search-icon" aria-hidden="true"><IconSearch /></span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search help"
            aria-label="Search help topics"
          />
        </label>
      </div>

      {groups.length === 0 ? (
        <div className="empty-state">
          Nothing matches “{query.trim()}”. Try a word like <em>microphone</em>, <em>audio</em>, or <em>review</em>.
        </div>
      ) : (
        groups.map((group) => (
          <section className="help-group" key={group.group}>
            <h4 className="help-group-title">{group.group}</h4>
            <div className="help-items">
              {group.items.map((item) => (
                // Native <details> so keyboard, screen readers, and browser
                // find-in-page all work without re-implementing any of it.
                // Searching auto-opens results so matches are readable at a glance.
                <details className="help-item" key={item.q} open={searching}>
                  <summary className="help-q">
                    <span>{item.q}</span>
                    <span className="help-chev" aria-hidden="true"><IconChevron /></span>
                  </summary>
                  <div className="help-a">
                    {item.a.map((p) => (
                      <p key={p}>{p}</p>
                    ))}
                    {item.link && (
                      <Link className="link-inline" to={item.link.to}>
                        {item.link.label}
                      </Link>
                    )}
                  </div>
                </details>
              ))}
            </div>
          </section>
        ))
      )}

      <section className="settings-section help-contact">
        <h3>Check your setup</h3>
        <SetupCheck />
      </section>

      <section className="settings-section help-contact">
        <h3>Still stuck?</h3>
        {SUPPORT_EMAIL ? (
          <>
            <p className="list-sub">
              Send us what happened and roughly when — the call time helps us find it. We read every message.
            </p>
            <div className="settings-actions">
              <a className="link-button" href={`mailto:${SUPPORT_EMAIL}?subject=HusAI%20support`}>
                Email support
              </a>
              <span className="list-sub">{SUPPORT_EMAIL}</span>
            </div>
          </>
        ) : (
          <p className="list-sub">
            A dedicated support inbox is on its way. In the meantime, most account, billing, and microphone
            questions are answered in <Link className="link-inline" to="/settings">Settings</Link>.
          </p>
        )}
      </section>
    </div>
  );
}
