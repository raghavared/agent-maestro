# Paid Subscriptions & Costs — Agent Maestro Monetization Guide

Complete breakdown of all paid subscriptions, platforms, and recurring costs needed to monetize and distribute Agent Maestro. Each item specifies whether it can be done **agentically** (automated/scripted) or requires **manual human action**.

---

## Quick Reference — What's Agentic vs Manual

| Action | Agentic? | Manual? | Notes |
|--------|----------|---------|-------|
| Apple Developer signup | ❌ | ✅ | Requires identity verification, payment |
| Lemon Squeezy account setup | ❌ | ✅ | Requires bank/tax info |
| Domain registration | ❌ | ✅ | Requires payment, DNS may need manual config |
| Landing page code | ✅ | ❌ | Agent can scaffold/build the site |
| License key integration code | ✅ | ❌ | Agent can implement API calls |
| Hosting deployment config | ✅ | ❌ | Agent can write Dockerfiles, railway.json, fly.toml |
| Hosting account creation | ❌ | ✅ | Requires payment/identity |
| Database schema & migrations | ✅ | ❌ | Agent can write SQL/Prisma schemas |
| Auth integration code | ✅ | ❌ | Agent can implement Clerk/Auth0 SDK |
| Auth account setup | ❌ | ✅ | Requires account creation, API keys |
| Email templates | ✅ | ❌ | Agent can write HTML email templates |
| Email service signup | ❌ | ✅ | Requires account, domain verification |
| Analytics integration code | ✅ | ❌ | Agent can add PostHog/Plausible snippets |
| CI/CD pipeline config | ✅ | ❌ | Agent can write GitHub Actions workflows |
| Code signing (macOS notarization) | ⚠️ Partial | ✅ | Agent can write scripts; certs need manual setup |
| Stripe/payment webhook handlers | ✅ | ❌ | Agent can implement webhook endpoints |
| Discord server setup | ❌ | ✅ | Manual community creation |
| Product Hunt launch | ❌ | ✅ | Manual submission and engagement |

---

## Phase 1 — Day 1 Essentials (Desktop Sales Only)

**Estimated upfront cost: ~$120/year**

### 1. Apple Developer Program — $99/year

**What:** Required to code-sign and notarize macOS `.dmg` for distribution. Without this, users see "unidentified developer" warnings and Gatekeeper blocks the app.

**Sign up:** https://developer.apple.com/programs/

**Setup steps:**
1. **[MANUAL]** Enroll at developer.apple.com with your Apple ID
2. **[MANUAL]** Complete identity verification (may take 24-48 hours)
3. **[MANUAL]** Pay $99 annual fee
4. **[MANUAL]** Create a "Developer ID Application" certificate in Xcode or the Developer portal
5. **[AGENTIC]** Configure Tauri build to use the signing identity — agent can update `tauri.conf.json` and create signing scripts
6. **[AGENTIC]** Write notarization script using `xcrun notarytool` — agent can automate this in CI/CD

**What you get:**
- Developer ID Application certificate
- Notarization via `xcrun notarytool`
- Access to Apple developer tools and beta SDKs

**Key files agent can create/modify:**
- `maestro-ui/src-tauri/tauri.conf.json` — signing config
- `.github/workflows/build-macos.yml` — CI notarization step
- `scripts/notarize.sh` — local notarization script

---

### 2. Lemon Squeezy — Free to start, 5% + $0.50/transaction

**What:** Payment processor that handles license key generation, payments, tax compliance, and digital delivery. This is the fastest path to accepting money.

**Sign up:** https://lemonsqueezy.com

**Setup steps:**
1. **[MANUAL]** Create Lemon Squeezy account
2. **[MANUAL]** Add bank account / payout method
3. **[MANUAL]** Complete tax information (W-9 or W-8BEN)
4. **[MANUAL]** Create products in dashboard:
   - Individual License: $29 one-time or $9/mo
   - Team License (5 seats): $99 one-time or $29/mo
   - Unlimited License: $199 one-time
5. **[MANUAL]** Upload `.dmg` / `.exe` / `.AppImage` builds to each product variant
6. **[AGENTIC]** Implement license key validation in the app:
   - API call to `https://api.lemonsqueezy.com/v1/licenses/validate`
   - Grace period logic for offline usage
   - License activation/deactivation endpoints
7. **[AGENTIC]** Implement webhook handler for purchase events
8. **[AGENTIC]** Build checkout integration on landing page (embed or redirect)

**Alternative options:**
| Platform | Fee | Pros | Cons |
|----------|-----|------|------|
| Lemon Squeezy | 5% + $0.50/tx | Tax handling, license keys, easy setup | Higher per-tx fee |
| Gumroad | 10%/tx | Very simple | Expensive at scale |
| Stripe direct | 2.9% + $0.30/tx | Lowest fees | You handle tax/licensing yourself |

**Key files agent can create/modify:**
- `maestro-server/src/routes/license.ts` — validation endpoint
- `maestro-server/src/routes/webhooks.ts` — Lemon Squeezy webhooks
- `maestro-ui/src/components/LicenseGate.tsx` — UI license check
- `maestro-ui/src/hooks/useLicense.ts` — license state management

---

### 3. Domain Name — ~$10-15/year

**What:** Professional URL for your landing page and checkout (e.g., `agentmaestro.dev`, `maestro.tools`, `agentmaestro.app`).

**Recommended registrars:**
- **Cloudflare Registrar** — at-cost pricing, free DNS/CDN
- **Namecheap** — competitive pricing
- **Google Domains** (now Squarespace) — simple UI

**Setup steps:**
1. **[MANUAL]** Search and register your domain
2. **[MANUAL]** Configure DNS to point to your hosting (A record or CNAME)
3. **[AGENTIC]** Set up Cloudflare for CDN/SSL if using Cloudflare
4. **[AGENTIC]** Configure domain in deployment config (Vercel, Railway, etc.)

**Suggested domains to check:**
- `agentmaestro.dev`
- `agentmaestro.app`
- `maestro.tools`
- `getmaestro.dev`

---

### 4. Analytics — $0-9/month

**What:** Track landing page conversions, feature usage, and sales funnel metrics.

**Recommended: PostHog (free up to 1M events/month)**

**Setup steps:**
1. **[MANUAL]** Create PostHog account at https://posthog.com
2. **[MANUAL]** Get project API key
3. **[AGENTIC]** Add PostHog snippet to landing page
4. **[AGENTIC]** Add in-app analytics for feature usage tracking
5. **[AGENTIC]** Create custom events: `app_opened`, `license_activated`, `task_created`, `session_spawned`, etc.

**Alternative options:**
| Platform | Cost | Pros | Cons |
|----------|------|------|------|
| PostHog | Free (1M events) | Feature flags, session replay, self-hostable | Learning curve |
| Plausible | $9/mo | Privacy-friendly, simple | Web only, no in-app |
| Google Analytics | Free | Widely known | Privacy concerns, complex |
| Vercel Analytics | Free tier | Auto-integrated with Vercel | Web only |

**Key files agent can create/modify:**
- `maestro-website/src/lib/analytics.ts` — analytics wrapper
- `maestro-ui/src/lib/telemetry.ts` — in-app telemetry (opt-in)

---

### 5. CI/CD for Automated Builds — $0-15/month

**What:** Automatically build cross-platform installers (macOS, Windows, Linux) on every release.

**Recommended: GitHub Actions (free for public repos, 2,000 min/mo private)**

**Setup steps:**
1. **[AGENTIC]** Write GitHub Actions workflow for cross-platform Tauri builds
2. **[AGENTIC]** Configure code signing in CI (using repository secrets)
3. **[MANUAL]** Add signing certificates as GitHub Secrets:
   - `APPLE_CERTIFICATE` — base64 encoded .p12
   - `APPLE_CERTIFICATE_PASSWORD`
   - `APPLE_ID` — for notarization
   - `APPLE_PASSWORD` — app-specific password
   - `APPLE_TEAM_ID`
4. **[AGENTIC]** Configure artifact upload and release creation
5. **[AGENTIC]** Add Lemon Squeezy upload step (via API) to publish builds after CI passes

**Cost note:** macOS runners cost 10x Linux minutes on GitHub Actions. A typical Tauri build takes ~15 min on macOS, ~5 min on Linux/Windows. Budget ~500 min/mo for weekly releases.

**Key files agent can create/modify:**
- `.github/workflows/release.yml` — full release pipeline
- `.github/workflows/build-test.yml` — PR build checks
- `scripts/upload-to-lemonsqueezy.sh` — post-build upload

---

## Phase 2 — Month 1-2 (Cloud/SaaS Tier)

**Estimated additional cost: +$30-120/month**

### 6. Hosting for Maestro Cloud — $5-50/month

**What:** Hosted version of Maestro for users who don't want to run the server locally. This is the SaaS tier.

**Recommended: Railway ($5-20/month to start)**

**Setup steps:**
1. **[MANUAL]** Create Railway account, link GitHub repo
2. **[AGENTIC]** Create `railway.json` / `Procfile` for deployment config
3. **[AGENTIC]** Write `Dockerfile` for maestro-server
4. **[AGENTIC]** Configure environment variables template
5. **[AGENTIC]** Set up health check endpoints
6. **[AGENTIC]** Implement multi-tenant isolation logic
7. **[MANUAL]** Configure custom domain in Railway dashboard

**Alternative options:**
| Platform | Cost | Pros | Cons |
|----------|------|------|------|
| Railway | $5-20/mo | Easy deploy, good DX | Scales can get pricey |
| Fly.io | $5-15/mo | Edge deployment, generous free tier | More config needed |
| Render | $7-25/mo | Simple, good free tier | Cold starts on free |
| DigitalOcean | $5-20/mo | Predictable pricing | More ops work |
| AWS (ECS/Fargate) | $10-50/mo | Enterprise-grade | Complex setup |

**Key files agent can create/modify:**
- `Dockerfile` — container build
- `railway.json` — Railway deployment config
- `fly.toml` — Fly.io config (alternative)
- `docker-compose.yml` — local development
- `maestro-server/src/middleware/tenant.ts` — multi-tenant middleware

---

### 7. Database (for Multi-tenant SaaS) — $0-25/month

**What:** SQLite works for desktop, but multi-tenant SaaS needs a proper database.

**Recommended: Supabase (free tier, then $25/mo Pro) or Railway Postgres (included)**

**Setup steps:**
1. **[MANUAL]** Create database instance on chosen platform
2. **[MANUAL]** Get connection string / credentials
3. **[AGENTIC]** Write migration scripts from SQLite to Postgres
4. **[AGENTIC]** Update ORM/query layer to support both SQLite (desktop) and Postgres (cloud)
5. **[AGENTIC]** Add tenant isolation to all queries
6. **[AGENTIC]** Write seed data and migration CLI

**Alternative options:**
| Platform | Free Tier | Paid | Notes |
|----------|-----------|------|-------|
| Supabase | 500MB | $25/mo | Includes Auth, Realtime |
| PlanetScale | 5GB | $29/mo | MySQL, branching |
| Neon Postgres | 512MB | $19/mo | Serverless Postgres |
| Railway Postgres | Included | Included | Bundled with hosting |

**Key files agent can create/modify:**
- `maestro-server/src/db/postgres.ts` — Postgres adapter
- `maestro-server/src/db/migrations/` — migration scripts
- `maestro-server/src/db/tenant-isolation.ts` — row-level security

---

### 8. Authentication Service — $0-25/month

**What:** User accounts, login, and session management for the SaaS tier.

**Recommended: Clerk (free up to 10,000 MAUs)**

**Setup steps:**
1. **[MANUAL]** Create Clerk account at https://clerk.com
2. **[MANUAL]** Configure OAuth providers (GitHub, Google) in dashboard
3. **[MANUAL]** Get API keys (publishable + secret)
4. **[AGENTIC]** Install and configure Clerk SDK in maestro-server
5. **[AGENTIC]** Add auth middleware to API routes
6. **[AGENTIC]** Build sign-in/sign-up UI components
7. **[AGENTIC]** Implement role-based access control (free, pro, enterprise)
8. **[AGENTIC]** Connect user identity to license keys

**Alternative options:**
| Platform | Free Tier | Paid | Notes |
|----------|-----------|------|-------|
| Clerk | 10,000 MAU | $25/mo | Best DX, React components |
| Auth0 | 7,500 MAU | $23/mo | Enterprise features |
| Supabase Auth | Included | Included | If using Supabase DB |
| Firebase Auth | 50,000 MAU | Free | Google ecosystem |

**Key files agent can create/modify:**
- `maestro-server/src/middleware/auth.ts` — auth middleware
- `maestro-ui/src/components/auth/` — login/signup UI
- `maestro-server/src/routes/auth.ts` — auth routes

---

### 9. Email Service — $0-20/month

**What:** Transactional emails (license delivery, onboarding) and marketing emails.

**Recommended: Resend (free up to 3,000 emails/month)**

**Setup steps:**
1. **[MANUAL]** Create Resend account at https://resend.com
2. **[MANUAL]** Verify sending domain (add DNS records)
3. **[MANUAL]** Get API key
4. **[AGENTIC]** Create email templates:
   - Welcome / onboarding email
   - License key delivery
   - Subscription renewal reminder
   - Feature announcement templates
5. **[AGENTIC]** Implement email sending service in maestro-server
6. **[AGENTIC]** Set up drip campaign logic for trial → paid conversion

**Note:** Lemon Squeezy handles purchase receipts automatically. You only need Resend for custom onboarding sequences and marketing.

**Alternative options:**
| Platform | Free Tier | Paid | Notes |
|----------|-----------|------|-------|
| Resend | 3,000/mo | $20/mo | Modern API, React email support |
| Postmark | 100/mo trial | $15/mo | Best deliverability |
| Brevo | 300/day | $25/mo | Marketing automation included |
| AWS SES | 62,000/mo (from EC2) | $0.10/1000 | Cheapest at scale |

**Key files agent can create/modify:**
- `maestro-server/src/services/email.ts` — email service
- `maestro-server/src/emails/` — React Email templates
- `maestro-server/src/jobs/drip-campaign.ts` — onboarding drip

---

## Phase 3 — Optional / Growth

### 10. Stripe (Direct) — 2.9% + $0.30/transaction

**When needed:** If you outgrow Lemon Squeezy, need custom billing, or want enterprise invoicing.

**Setup steps:**
1. **[MANUAL]** Create Stripe account, complete verification
2. **[MANUAL]** Configure products and pricing in Stripe Dashboard
3. **[AGENTIC]** Implement Stripe Checkout integration
4. **[AGENTIC]** Build customer portal for subscription management
5. **[AGENTIC]** Implement webhook handlers for payment events
6. **[AGENTIC]** Add metered billing for usage-based pricing (enterprise tier)

---

### 11. Discord Community — Free

**Setup steps:**
1. **[MANUAL]** Create Discord server
2. **[MANUAL]** Set up channels: #general, #support, #feature-requests, #announcements, #showcase
3. **[MANUAL]** Configure roles: Free User, Pro User, Enterprise, Contributor
4. **[AGENTIC]** Build Discord bot for license verification (link Discord account to license)
5. **[AGENTIC]** Set up webhook for release announcements

---

### 12. Product Hunt Launch — Free

**Everything is manual:**
1. **[MANUAL]** Create Product Hunt maker account
2. **[MANUAL]** Prepare launch assets: tagline, description, 5 screenshots, demo video
3. **[MANUAL]** Schedule launch for a Tuesday (best day for visibility)
4. **[MANUAL]** Engage with comments on launch day
5. **[AGENTIC]** Agent can draft the Product Hunt copy and prepare screenshot captions

---

### 13. GitHub Sponsors — Free

**Setup steps:**
1. **[MANUAL]** Enable GitHub Sponsors on your profile
2. **[MANUAL]** Configure sponsorship tiers
3. **[AGENTIC]** Agent can write the FUNDING.yml and sponsor tier descriptions

---

## Cost Summary

### Phase 1 — Desktop Sales Only (~$120/year minimum)

| Item | Cost | Type |
|------|------|------|
| Apple Developer Program | $99/year | Fixed |
| Domain name | ~$12/year | Fixed |
| Lemon Squeezy | 5% + $0.50/tx | Variable |
| PostHog analytics | Free | Free tier |
| GitHub Actions CI/CD | Free (public) / $4/mo (private) | Variable |
| **Total fixed** | **~$111/year** | |

### Phase 2 — Add Cloud/SaaS (+$30-120/month)

| Item | Cost | Type |
|------|------|------|
| Hosting (Railway) | $5-20/mo | Variable |
| Database (Supabase) | $0-25/mo | Variable |
| Auth (Clerk) | $0-25/mo | Variable |
| Email (Resend) | $0-20/mo | Variable |
| **Total range** | **$5-90/mo** | |

### Phase 3 — Growth (+$0-50/month)

| Item | Cost | Type |
|------|------|------|
| Stripe | Per-transaction only | Variable |
| Discord | Free | Free |
| Product Hunt | Free | Free |
| Plausible upgrade | $9/mo | Optional |
| **Total range** | **$0-9/mo** | |

---

## Break-Even Analysis

| Scenario | Revenue | Covers |
|----------|---------|--------|
| 5 sales at $29 | $145 | Phase 1 annual costs |
| 15 subscribers at $9/mo | $135/mo | Phase 2 monthly costs |
| 50 subscribers at $9/mo | $450/mo | All costs + profit |
| 10 team licenses at $29/mo | $290/mo | All costs + significant profit |

---

## Implementation Roadmap

### Week 1 — Setup Accounts (Mostly Manual)
- [ ] Register Apple Developer Program
- [ ] Create Lemon Squeezy account + configure products
- [ ] Register domain
- [ ] Set up PostHog analytics account

### Week 1-2 — Build Integration (Agentic)
- [ ] Implement license key validation in app
- [ ] Build landing page with checkout integration
- [ ] Set up CI/CD pipeline for cross-platform builds
- [ ] Add code signing to build pipeline
- [ ] Add analytics to landing page and app

### Week 2-4 — Launch Desktop Version
- [ ] Upload signed builds to Lemon Squeezy
- [ ] Deploy landing page
- [ ] Launch on social media / communities
- [ ] Set up Discord community

### Month 1-2 — Build SaaS Tier (Agentic + Manual)
- [ ] Set up hosting (Railway/Fly.io)
- [ ] Migrate to Postgres for multi-tenant
- [ ] Integrate authentication (Clerk)
- [ ] Set up email service (Resend)
- [ ] Deploy Maestro Cloud

### Month 2-3 — Scale
- [ ] Product Hunt launch
- [ ] GitHub Sponsors
- [ ] Enterprise tier features
- [ ] Stripe direct integration if needed

---

## Agentic Implementation Priority

These are the tasks an agent can fully implement without any manual account setup:

1. **License key validation** — API integration code, UI gate, webhook handlers
2. **Landing page** — Full website with checkout embed
3. **CI/CD pipeline** — GitHub Actions workflows for build + sign + release
4. **Analytics integration** — PostHog/Plausible snippets in web and app
5. **Email templates** — React Email templates for onboarding and marketing
6. **Auth middleware** — Clerk/Auth0 SDK integration
7. **Database migrations** — SQLite → Postgres migration scripts
8. **Docker/deployment config** — Dockerfile, railway.json, fly.toml
9. **Multi-tenant isolation** — Tenant middleware, row-level security
10. **Discord bot** — License verification bot

All of these can be built in parallel while you handle the manual account setups.

---

*Last updated: 2026-02-25*
