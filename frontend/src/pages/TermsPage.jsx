import { Link } from 'react-router-dom';

/**
 * Terms of Service and Privacy Notice.
 *
 * Written against the Philippines' Data Privacy Act of 2012 (RA 10173),
 * because that is the law the users and the team are actually under. The
 * structure follows what the Act requires a personal information controller to
 * disclose: what is collected, the purpose, the lawful basis, who it is shared
 * with, how long it is kept, the data subject's rights under Section 16, and
 * how to exercise them.
 *
 * TERMS_VERSION in the backend must be bumped whenever this text changes
 * materially — consent under the Act is specific to what was disclosed, so
 * agreement to an older version is not agreement to this one.
 *
 * NOT LEGAL ADVICE. This is a good-faith, well-researched draft for a student
 * prototype. Have a lawyer review it before taking real payments or handling
 * real client calls at scale.
 */
export const TERMS_VERSION = '2026-07-31';

export default function TermsPage() {
  return (
    <div className="page legal-page">
      <div className="page-header">
        <h2>Terms of Service &amp; Privacy Notice</h2>
        <Link to="/" className="link-button">
          ← Back
        </Link>
      </div>

      <p className="list-sub">
        Version {TERMS_VERSION} · HusAI, a student project of the USTP CET Startup Incubation
        Program
      </p>

      <div className="legal-callout">
        <h3>The short version</h3>
        <ul>
          <li>
            <strong>Your calls are never used to train AI models.</strong> Not ours, not anyone
            else&apos;s.
          </li>
          <li>
            <strong>You own your recordings and transcripts.</strong> You can export or delete them
            at any time.
          </li>
          <li>
            <strong>Transcripts auto-delete</strong> on the schedule you choose in Settings (30 days
            by default).
          </li>
          <li>
            <strong>You are responsible for consent on your calls.</strong> Please tell the people
            you are speaking with that you are using a coaching tool.
          </li>
        </ul>
      </div>

      <h3>1. What HusAI does</h3>
      <p>
        HusAI is a communication coaching tool. It listens to your side of a client call and, when
        you share your meeting tab&apos;s audio, the client side as well. It offers suggestions
        during the call and produces a review afterwards. It is a coaching aid — it is not a
        transcription service of record, and its suggestions are not professional, legal, or
        financial advice.
      </p>

      <h3>2. Who we are</h3>
      <p>
        HusAI is operated by the HusAI team under the USTP CET Startup Incubation Program. For the
        purposes of Republic Act No. 10173 (the Data Privacy Act of 2012), we act as the{' '}
        <em>personal information controller</em> for the data described below. You can reach us at{' '}
        <a href="mailto:privacy@husai.app">privacy@husai.app</a>.
      </p>

      <h3>3. What we collect</h3>
      <ul>
        <li>
          <strong>Account data</strong> — your email address, display name, and optional avatar.
        </li>
        <li>
          <strong>Call transcripts</strong> — the text of what was said on calls you record,
          labelled by speaker, with timestamps relative to the start of the call.
        </li>
        <li>
          <strong>Coaching output</strong> — the reviews, scores, insights, and practice sessions
          generated from those transcripts.
        </li>
        <li>
          <strong>Usage data</strong> — how many calls you have made and their length, so we can
          apply plan limits.
        </li>
        <li>
          <strong>Billing data</strong> — if you subscribe, your payment is handled by Stripe. We
          store only your subscription status and Stripe&apos;s customer identifier. We never see or
          store your card number.
        </li>
      </ul>
      <p>
        <strong>We do not store call audio.</strong> Audio is transcribed and the audio itself is
        discarded; only the resulting text is saved.
      </p>

      <h3>4. Why we process it, and on what basis</h3>
      <p>
        We process your data to provide the service you asked for — that is, under RA 10173, the
        lawful basis of <em>performance of a contract with you</em> for the core coaching features,
        and your <em>consent</em> for anything optional. We process it for these purposes and no
        others:
      </p>
      <ul>
        <li>To transcribe your calls and generate coaching feedback.</li>
        <li>To show you your own history and progress over time.</li>
        <li>To apply the limits of your plan and, if you subscribe, to bill you.</li>
        <li>To keep the service secure and working.</li>
      </ul>

      <h3 id="no-ai-training">5. We do not use your calls to train AI</h3>
      <div className="legal-callout strong">
        <p>
          <strong>
            Your transcripts, recordings, reviews, and practice sessions are never used to train,
            fine-tune, or otherwise improve any AI or machine learning model — ours or a third
            party&apos;s.
          </strong>
        </p>
        <p>
          Your content is sent to our AI providers only to generate <em>your</em> result, in the
          moment you asked for it. We use providers under agreements that prohibit training on data
          submitted through their APIs. We do not sell your data, and we do not share it with
          advertisers or data brokers.
        </p>
      </div>

      <h3>6. Who your data is shared with</h3>
      <p>
        We use a small number of processors, each doing one job and bound to process data only on
        our instructions:
      </p>
      <ul>
        <li>
          <strong>Supabase</strong> — account authentication and database hosting.
        </li>
        <li>
          <strong>Groq</strong> and <strong>Google (Gemini)</strong> — speech-to-text and the AI
          that produces coaching feedback.
        </li>
        <li>
          <strong>Stripe</strong> — payment processing, if you subscribe.
        </li>
      </ul>
      <p>
        Some of these providers process data outside the Philippines. Where that happens we remain
        responsible for your data and rely on the providers&apos; contractual commitments to give it
        a comparable level of protection, as RA 10173 requires for cross-border transfers.
      </p>

      <h3>7. How long we keep it</h3>
      <ul>
        <li>
          <strong>Transcripts</strong> — deleted automatically after the retention period you set in
          Settings. The default is 30 days.
        </li>
        <li>
          <strong>Reviews and progress metrics</strong> — kept while your account is open, because
          they are the record of your improvement over time. They contain quoted excerpts from your
          transcripts.
        </li>
        <li>
          <strong>Account and billing records</strong> — kept while your account is open, and after
          closure only as long as we are legally required to.
        </li>
      </ul>
      <p>When you delete your account, your data is deleted with it.</p>

      <h3>8. Your rights under the Data Privacy Act</h3>
      <p>Section 16 of RA 10173 gives you the right to:</p>
      <ul>
        <li>
          <strong>Be informed</strong> — that is what this notice is for.
        </li>
        <li>
          <strong>Access</strong> your personal data and know how it is being processed.
        </li>
        <li>
          <strong>Object</strong> to processing, including withdrawing consent.
        </li>
        <li>
          <strong>Rectify</strong> data that is inaccurate or out of date.
        </li>
        <li>
          <strong>Erasure or blocking</strong> — have your data suspended, withdrawn, or destroyed
          where it is incomplete, outdated, false, or unlawfully obtained.
        </li>
        <li>
          <strong>Data portability</strong> — obtain a copy of your data in an electronic format.
        </li>
        <li>
          <strong>Damages</strong> — be indemnified for harm caused by inaccurate or unauthorised
          use of your data.
        </li>
      </ul>
      <p>
        Most of these you can exercise yourself in Settings. For anything else, email{' '}
        <a href="mailto:privacy@husai.app">privacy@husai.app</a> and we will respond within 15 days.
        If you are not satisfied, you may complain to the{' '}
        <a href="https://privacy.gov.ph" target="_blank" rel="noreferrer">
          National Privacy Commission
        </a>
        .
      </p>

      <h3>9. Security and breaches</h3>
      <p>
        We use reasonable organisational, physical, and technical measures to protect your data,
        including encryption in transit and access controls on our database. No system is perfectly
        secure. If a breach occurs that puts your personal data at real risk of serious harm, we
        will notify the National Privacy Commission and affected users within 72 hours of
        establishing knowledge of it, as RA 10173 requires.
      </p>

      <h3>10. Recording other people</h3>
      <p>
        This one is on you, and it matters. When you record a call, you are capturing other
        people&apos;s speech. You are responsible for having whatever consent the law and your
        client&apos;s expectations require — in the Philippines, recording a private conversation
        without the consent of all parties can be an offence under RA 4200 (the Anti-Wiretapping
        Act). Tell the people on your calls that you are using a coaching tool that transcribes
        them. HusAI will not do this for you.
      </p>

      <h3>11. Your account</h3>
      <ul>
        <li>You must be at least 18, and provide accurate account information.</li>
        <li>Do not share your account, or use HusAI to break the law or someone else&apos;s rights.</li>
        <li>
          Free plans include a limited number of calls and minutes per month. Paid plans are billed
          in advance and can be cancelled at any time, taking effect at the end of the current
          period.
        </li>
        <li>We may suspend accounts that abuse the service or put other users at risk.</li>
      </ul>

      <h3>12. The honest limitations</h3>
      <p>
        HusAI is a prototype built by students. Transcription makes mistakes, particularly with
        accents, names, and crosstalk. Coaching suggestions are generated by an AI model and can be
        wrong or unhelpful. Scores are indicative, not authoritative. Use your own judgement — the
        service is provided &ldquo;as is&rdquo;, without warranty, and our liability is limited to
        what you paid us in the previous three months.
      </p>

      <h3>13. Changes</h3>
      <p>
        If we change these terms in a way that affects how your data is handled, we will ask you to
        review and accept the new version before you continue using HusAI. Consent under RA 10173 is
        specific to what was disclosed, so we do not treat your earlier agreement as covering new
        terms.
      </p>

      <p className="list-sub" style={{ marginTop: 28 }}>
        This notice is a good-faith draft for a student prototype and is not legal advice.
      </p>
    </div>
  );
}
