# Maestro Offline macOS Packaging + Paid Plan Options

## Goal
Ship Maestro as a **fully offline-capable macOS product** with a paid commercial offering.

## Current Baseline (from codebase)
- App stack: Tauri v2 desktop app (`maestro-ui`) with Rust backend sidecar execution.
- Current packaging config is generic (`bundle.targets: all`) with no production signing/notarization config in `tauri.conf.json`.
- Capabilities include shell spawn/execute (`shell:allow-spawn`, `shell:allow-execute` sidecar), which is important for packaging channel decisions.
- Existing release planning doc exists for Mac App Store: `docs/MAC_APP_STORE_RELEASE_PLAN.md`.
- Licensing mismatch exists now:
  - `LICENSE` and `README.md` indicate AGPL-3.0.
  - `package.json` declares MIT.

## What "Complete Offline" Means Here
- App install works without internet.
- Core orchestration/task/session behavior works without internet.
- License validation can work without internet for a defined grace period (or fully offline with local key/receipt rules).
- Updates are optional and manually downloadable when online.

## Packaging Options (macOS)

### Option 1 (Recommended): Direct Download (DMG) + Offline License Key
Best fit for "complete offline" and fastest path.

How it works:
- Distribute signed/notarized `.dmg` directly from your site.
- Customer buys on web checkout (Stripe/Paddle/Lemon Squeezy).
- Customer receives license key file (or activation code).
- App validates license locally using signed token/public-key verification.

Pros:
- Maximum product freedom (no App Store sandbox review constraints).
- Best support for shell/sidecar-heavy architecture.
- Strong offline support (no mandatory store connection).
- You keep customer relationship and billing control.

Cons:
- You must build your own licensing, refunds, tax handling UX.
- Need trust-building (codesign + notarization + reputation).

### Option 2: Direct Download + Team License File (Enterprise Offline)
Best for B2B/internal networks and air-gapped customers.

How it works:
- Sell seat packs (e.g., 10/25/100 users) and issue signed organization license files.
- License file contains org, seat count, expiry/version rights, and optional machine limits.
- Validation is fully local with your embedded public key.

Pros:
- Works in strict enterprise/offline environments.
- Easier procurement than per-user subscriptions.
- High ACV potential with support/SLA add-ons.

Cons:
- Requires careful license ops (renewal, revocation policy, abuse handling).

### Option 3: Mac App Store Distribution (Paid Upfront or IAP)
Useful for discoverability, not ideal for this architecture as-is.

How it works:
- Build MAS-compatible variant (sandbox entitlements, StoreKit billing).
- Sell as paid app and/or in-app subscription.

Pros:
- Built-in trust, distribution, and update channel.
- Apple handles payments in-store.

Cons / Risks for Maestro:
- Shell spawn/command execution model is likely problematic for MAS policy and sandboxing.
- Requires variant architecture or significant feature gating.
- Revenue share and review latency.
- True offline paid-subscription behavior is weaker (periodic store/account checks).

Practical position:
- Treat MAS as a **separate constrained SKU** ("Maestro Lite") later, not the primary full-offline commercial SKU.

### Option 4: Homebrew Cask + External Licensing
Developer-friendly channel layered on Option 1.

How it works:
- Publish notarized app and cask for install/update convenience.
- Licensing remains external (license key/org file).

Pros:
- Fast adoption among technical users.
- Keeps direct billing control.

Cons:
- Less consumer-friendly than DMG drag-and-drop for non-technical buyers.

## Paid Plan Models for Offline Product

### Model A: Perpetual License + Annual Maintenance (Recommended for offline-first)
- Example:
  - Individual perpetual: $149-$299
  - Team pack perpetual (5 seats): $699-$999
  - Annual maintenance: 20-30% for updates/support
- Good for offline and enterprise procurement.

### Model B: Annual Subscription with Offline Grace
- Example:
  - Pro: $19-$39/user/month billed annually
  - Team: $79-$199/org/month tiered by seats
- Implement offline token with long TTL (e.g., 30-90 days) then re-check when online.
- Better MRR, more license complexity.

### Model C: Hybrid (Best long-term)
- Individual users: subscription.
- Enterprise/offline customers: perpetual + support contract.

## Recommended Strategy
1. Launch with **Option 1 + Option 2**:
   - Direct notarized DMG as primary channel.
   - Add enterprise offline license file for teams.
2. Start paid model as **Hybrid**:
   - Individual subscription (annual preferred).
   - Team/enterprise perpetual + maintenance contract.
3. Evaluate MAS only after shipping a constrained MAS-compatible variant.

## Technical Implementation Blueprint

### Phase 1: Production Packaging Foundation (1-2 weeks)
- Add macOS-specific bundle config in `maestro-ui/src-tauri/tauri.conf.json`:
  - `bundle.macOS.minimumSystemVersion`
  - `bundle.macOS.signingIdentity`
  - DMG layout customization.
- Add `src-tauri/Info.plist` and `src-tauri/Entitlements.plist`.
- Build artifacts:
  - `npm run tauri build -- --bundles app,dmg`
- Validate signatures:
  - `codesign -vvv --deep --strict <App.app>`
  - `spctl --assess --type execute --verbose <App.app>`

### Phase 2: Signing + Notarization + Release Automation (1 week)
- Apple Developer setup (Developer ID Application cert).
- CI secrets for certificate and notarization API credentials:
  - `APPLE_CERTIFICATE`
  - `APPLE_CERTIFICATE_PASSWORD`
  - `APPLE_SIGNING_IDENTITY`
  - `APPLE_API_ISSUER`
  - `APPLE_API_KEY`
  - `APPLE_API_KEY_PATH`
- Add CI release job to output notarized DMG per version tag.

### Phase 3: Offline Licensing (2-4 weeks)
- Implement signed license token (Ed25519 recommended).
- License payload fields:
  - license_id, plan, seats, customer, issued_at, expires_at, max_version, machine_limit.
- Local validation only using embedded public key.
- Optional online checks when available; never block immediate offline use if token valid.
- UX:
  - Activate key/file
  - View license status
  - Export diagnostics for support

### Phase 4: Commercial Operations (1-2 weeks)
- Checkout/billing setup (Stripe/Paddle/Lemon Squeezy).
- Delivery automation: email license + invoice + tax receipts.
- Renewal and upgrade flows.
- Refund/reissue policy and abuse controls.

## Distribution Architecture Decision

Primary SKU (now):
- Maestro Desktop Pro (Direct DMG, notarized, offline-capable).

Secondary SKU (later):
- Maestro MAS Edition (feature-constrained, StoreKit billing, sandbox-safe).

Enterprise SKU:
- Maestro Offline Enterprise (signed PKG/DMG + org license file + SLA/support).

## Key Risks and Mitigations

1. MAS rejection risk due to shell/sidecar behavior.
- Mitigation: avoid MAS for primary SKU; develop MAS-specific restricted build if needed.

2. Licensing bypass/tampering risk.
- Mitigation: signed tokens, integrity checks, obfuscation, server-assisted fraud analytics when online.

3. Licensing/legal ambiguity from AGPL vs MIT mismatch.
- Mitigation: resolve license policy before first commercial release; publish clear dual-license/commercial terms.

4. Apple trust warnings for unsigned artifacts.
- Mitigation: always sign + notarize + staple tickets before release.

## Business/Policy Decisions Required (Blocking)

1. Final license strategy:
- AGPL-only, dual-license, or commercial proprietary edition.

2. Paid model at launch:
- Perpetual + maintenance, subscription, or hybrid.

3. Channel priority:
- Direct-only first (recommended) vs MAS investment now.

4. Enterprise commitments:
- SLA, support windows, and offline activation policy.

## 30-Day Execution Plan

Week 1:
- Finalize licensing/legal direction.
- Implement macOS signing/notarization pipeline.
- Produce first notarized DMG.

Week 2:
- Implement local license verifier and activation UX.
- Build checkout + license issuance script.

Week 3:
- Add plan tiers, seat handling, and renewal logic.
- Internal QA for fully offline startup and usage.

Week 4:
- Launch direct paid beta with 10-20 users.
- Gather pricing friction and activation failure data.
- Ship v1 public paid release.

## Concrete Recommendation
Launch a direct notarized DMG with offline license keys now, and position MAS as a later secondary SKU only if you want discoverability. This is the highest-probability path to a complete offline paid macOS product for the current Maestro architecture.
