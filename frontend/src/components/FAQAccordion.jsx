import { useId, useState } from 'react';

const FAQS = [
  { q: 'What is HusAI?', a: 'HusAI is a live communication coach for virtual assistants. It listens alongside you on client calls, offers ready-to-say suggestions the moment you need them, and turns every call into a personalized review and practice plan.' },
  { q: 'How is HusAI different from Otter.ai or Tactiq?', a: 'Those tools document meetings — they transcribe and summarize. HusAI coaches you in real time and trains you afterward. It never scores or critiques your client; only you are ever reviewed.' },
  { q: 'Does HusAI record my calls?', a: 'HusAI transcribes your conversation to power coaching and your review. You control how long transcripts are retained in Settings, and reviews are tied to your account only.' },
  { q: 'Can HusAI transcribe both sides of a conversation?', a: 'Yes. HusAI captures your microphone and the client’s audio on separate channels, so every insight knows exactly who said what — and only your side is ever coached.' },
  { q: 'How does the Lifeline work?', a: 'When it becomes your turn and you pause, HusAI generates three short, confident, context-aware replies drawn from the live conversation. You can read, use, or copy them — your client never notices.' },
  { q: 'Will Lifeline suggestions disappear while I am speaking?', a: 'No. Suggestions stay on screen while you talk so you have time to read and use them. They only change when you dismiss them, when a new set is generated, or when the session ends.' },
  { q: 'What is AI Review?', a: 'After every call, HusAI analyzes your side of the conversation and scores confidence, clarity, conciseness, and professionalism — with specific strengths, patterns to fix, and roleplay exercises built from your own words.' },
  { q: 'How does personalized Practice work?', a: 'Each weakness HusAI spots becomes a targeted roleplay. An AI client responds dynamically and gets more challenging as you improve, so the real call feels easy.' },
  { q: 'Can HusAI analyze pronunciation and speaking patterns?', a: 'HusAI tracks patterns like filler words, over-apologizing, hedging, and response latency, and turns them into concrete, practical coaching over time.' },
  { q: 'Does HusAI work with international clients?', a: 'Absolutely — it’s built for Filipino VAs working with US, UK, and AU clients, and handles English/Filipino code-switching in transcription.' },
  { q: 'Does HusAI support Windows and macOS?', a: 'HusAI runs in the browser (Chrome/Edge) and as a desktop companion for Windows and macOS, sharing the same account and data across devices.' },
  { q: 'Is my conversation data secure?', a: 'Your data is tied to your account, transported over HTTPS, and AI keys never touch the client. Transcript retention is configurable, and you can delete your account and all associated data at any time.' },
];

function FAQItem({ item, open, onToggle }) {
  const id = useId();
  return (
    <div className={`faq-item${open ? ' open' : ''}`}>
      <button
        className="faq-q"
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        id={`${id}-btn`}
        onClick={onToggle}
      >
        <span>{item.q}</span>
        <svg className="faq-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <div className="faq-a" id={`${id}-panel`} role="region" aria-labelledby={`${id}-btn`} hidden={!open}>
        <p>{item.a}</p>
      </div>
    </div>
  );
}

/** Accessible FAQ accordion: one open at a time, keyboard/ARIA/focus supported. */
export default function FAQAccordion() {
  const [openIndex, setOpenIndex] = useState(0);
  return (
    <div className="faq-list">
      {FAQS.map((item, i) => (
        <FAQItem key={item.q} item={item} open={openIndex === i} onToggle={() => setOpenIndex(openIndex === i ? -1 : i)} />
      ))}
    </div>
  );
}
