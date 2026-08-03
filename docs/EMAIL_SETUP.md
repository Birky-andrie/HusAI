# Fixing confirmation emails (no domain required)

**What's wrong:** Supabase's custom SMTP is correctly enabled and pointed at
Resend, but Resend's sandbox sender (`onboarding@resend.dev`) can only deliver
to the email address that owns the Resend account — every other signup gets
rejected, which Supabase surfaces as a generic 500
`"Error sending confirmation email"`.

**What's not changing:** Supabase Auth stays exactly as-is. This is a
one-screen settings change — the same **Authentication → Emails → SMTP
Settings** page already open in your dashboard, just with different provider
values plugged in. Nothing in the codebase needs to change: our backend's own
Resend integration (`backend/src/providers/email/index.ts`) is unused dead
code left over from before the move to Supabase Auth, and has no bearing on
this at all.

**Why not Resend with a verified domain:** Resend requires DNS records (SPF/
DKIM) added at your domain's registrar — a `*.vercel.app` deployment doesn't
give you that DNS control, only a domain you actually own does. Since you
don't have one yet, use one of the two options below instead.

---

## Option A — Gmail SMTP (fastest, zero new accounts)

Works with any Gmail address, including the one your Google account already
uses for OAuth in this app. Free, ~500 emails/day — far more than you need
right now.

1. **Turn on 2-Step Verification** on the Gmail account you'll send from, if
   it isn't already: [myaccount.google.com/security](https://myaccount.google.com/security).
2. **Create an App Password**: [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
   → app: "Mail", device: "Other" (name it "Supabase") → **Generate**. Copy
   the 16-character password it shows — you won't see it again.
3. In Supabase → **Authentication → Emails → SMTP Settings**, set:

   | Field | Value |
   |---|---|
   | Sender email address | your Gmail address |
   | Sender name | `HusAI` |
   | Host | `smtp.gmail.com` |
   | Port | `587` |
   | Username | your full Gmail address |
   | Password | the 16-character App Password (not your normal Gmail password) |

4. **Save changes**, then try registering again with a *different* email than
   before.

---

## Option B — SendGrid (single-sender verification, no domain)

A better fit if you'd rather not send from a personal Gmail, or expect to
outgrow Gmail's daily cap. Free tier: 100 emails/day, forever.

1. Sign up at [signup.sendgrid.com](https://signup.sendgrid.com/) (no card required for the free tier).
2. **Settings → Sender Authentication → Verify a Single Sender** → fill in the
   From address you want to send as (e.g. your own email or a
   `hello@` address you can receive mail at) → SendGrid emails you a
   verification link → click it. This is the step that replaces domain
   ownership — it verifies one address, not a whole domain.
3. **Settings → API Keys → Create API Key** → Full Access → copy the key
   (starts `SG.`) — shown once.
4. In Supabase → **Authentication → Emails → SMTP Settings**, set:

   | Field | Value |
   |---|---|
   | Sender email address | the exact address you verified in step 2 |
   | Sender name | `HusAI` |
   | Host | `smtp.sendgrid.net` |
   | Port | `587` |
   | Username | `apikey` (literally the word "apikey", not your SendGrid username) |
   | Password | the API key from step 3 |

5. **Save changes**, then try registering again.

---

## The proper long-term fix: buy a real domain

Many TLDs run $1–15/year (e.g. `.xyz`, `.site`, `.online` are often near $1
for the first year). Point it at your Vercel deployment, verify it in Resend
(15ish minutes: add the DNS records Resend gives you, wait for propagation),
and you get branded email (`noreply@husai.app`) instead of a Gmail/SendGrid
workaround — plus a real domain for the product generally, not just email.
Not urgent for Demo Day; worth doing once you're past the prototype stage.

---

## After switching

Confirm it actually worked rather than trusting the dashboard:

1. Register with a fresh email address (reusing one from a failed attempt may
   still be "unconfirmed" in Supabase and behave oddly).
2. Check that inbox for the confirmation email — should arrive within
   seconds.
3. If it still fails, check Supabase → **Authentication → Logs** for the exact
   provider error (a wrong App Password / API key shows up there clearly).
