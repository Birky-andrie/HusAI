# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Filipino Virtual Assistants (VAs) who take live calls with international clients (mostly US/UK/AU), typically via Google Meet/Zoom-style platforms. They are individually motivated to improve their own client-facing communication — confidence, clarity, conciseness, professionalism — usually while worried about client dissatisfaction jeopardizing the relationship (client churn, being let go, a bad review).

BPO/agency-purchased team access is a plausible future direction but not a confirmed product decision — the current, confirmed audience is the individual VA, self-directed and self-paying.

## Product Purpose

HusAI is a real-time AI communication coach. It listens during a live client call, coaches the VA in the moment, reviews the call afterward, and turns the gaps it finds into targeted practice — a continuous loop rather than a one-time assessment.

Success for the user is holding onto the client relationship: the client stays satisfied with how they're being communicated with, rather than churning or escalating over a communication breakdown.

## Positioning

Most tools in this space are after-the-fact: record the call, analyze it later. HusAI's mechanism is live, in-the-moment coaching during the call itself — dual-channel audio capture (the VA's own mic plus the client's shared tab/system audio) feeds a real-time "Lifeline" that suggests what to say next, surfaced in a floating coach window that stays visible even outside the browser (over Meet/Zoom/any app). A neighboring "record and review later" product could not truthfully claim this — the coaching happens while it still matters, not after the call has already gone wrong.

## Operating Context

A VA takes a live call on a meeting platform (Meet, Zoom, or similar) in a separate window/app, with HusAI running alongside — either as a browser tab with a floating coach window, or as a desktop (Electron) shell. They share their tab/system audio into HusAI so it can hear the client's side, while HusAI listens to their own microphone directly. The VA is often working solo, without a supervisor present, which is part of why in-the-moment coaching (not just after-the-fact feedback) matters — there is no one else to lean on mid-call.

After the call, the VA reviews an AI-generated analysis (scores, patterns, evidence quotes from their own words), then does AI roleplay practice sessions targeted at whatever the review or their recent trends indicate is weakest, and tracks progress over time.

## Capabilities and Constraints

- **Live coaching (Lifeline):** real-time suggestions during a call, triggered either by the VA's own silence (turn-based coaching) or, optionally, while multiple people on the client's side are talking among themselves (opt-in "Conversation Mode," for the VA to find a natural way to contribute rather than only responding when addressed).
- **No speaker diarization on the client side.** The client's shared audio is one channel; if multiple people are on that side, they are all transcribed as a single undifferentiated "Client side" voice. This is an acknowledged, current technical limitation, not a design choice — coaching logic and metrics are written to account for it (e.g., extended client-side exchanges are excluded from response-latency scoring rather than misread as the VA being slow).
- **Desktop app is a wrapper, not a distinct design language.** The Electron desktop shell uses the same web UI/design system as the browser; "platform" for design purposes is `web`, not `adaptive`.
- **AI providers:** Groq (low-latency) powers live coaching and practice roleplay; Gemini powers deeper post-call review analysis, with an automatic Groq fallback if Gemini is unavailable. Groq Whisper handles desktop transcription and client-side audio transcription; browser Web Speech API handles the VA's own voice in-browser (free, but lower accuracy than Whisper).
- **Billing infrastructure exists (Stripe: Checkout, Customer Portal, webhooks, Free/Pro subscription tracking), but no feature is currently gated behind Pro, and final pricing is not yet decided.** Treat any Pro/Free distinction in current UI copy as provisional, not a confirmed product commitment.
- **No team/agency/multi-seat structure exists yet.** Account model is single-user.

## Brand Commitments

Product name: **HusAI**. (Visual identity, color system, and typography are recorded separately and are out of scope for this file.)

## Evidence on Hand

No real customer testimonials, case studies, press mentions, or usage benchmarks exist yet. Do not fabricate any of these in future work — reference images in `ui/ux pics/` are aesthetic/layout references only, not real product screenshots or customer proof.

## Product Principles

1. Coach in the moment, not just after it — live intervention is the product's reason to exist, not a bonus feature layered onto call recording.
2. Never let the AI coaching invent claims, expertise, or facts the VA hasn't actually demonstrated — suggestions must be things the VA could credibly and honestly say.
3. Design around real technical limits rather than pretending they don't exist (no diarization, shared-quota AI providers) — metrics and coaching logic should degrade gracefully, not misrepresent what happened on a call.
4. The VA is usually alone when it matters most (mid-call, no supervisor) — the product should feel like a capable second set of ears, not an intrusive monitor.
5. Individual-first: design and pricing decisions should hold up for a single self-paying VA, even though agency/team distribution may come later.

## Accessibility & Inclusion

No product-specific accessibility requirement has been established yet.
