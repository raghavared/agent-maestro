# Mac App Store Release Plan - Maestro (Agents UI)

## Objective
Release the Tauri-based Maestro desktop app (`maestro-ui`) on the Mac App Store with compliant packaging, entitlements, metadata, and operational readiness.

## Current App Snapshot
- Product name in Tauri config: `Agents UI`
- Bundle identifier in Tauri config: `com.agents-ui.desktop`
- Current app version in Tauri config: `0.3.0`
- Platform stack: Tauri 2 + Rust backend + React frontend

## Release Workstreams

### 1. Product and Store Positioning
- Finalize app name for storefront and trademark risk check.
- Define value proposition, category, and target keywords.
- Prepare App Store listing copy (subtitle, description, release notes, support URL, marketing URL, privacy policy URL).
- Define pricing and territories.

### 2. Apple Account and Legal Readiness
- Verify active Apple Developer Program enrollment (Organization preferred).
- Confirm legal entity, agreements, tax, and banking in App Store Connect.
- Confirm role access for release team (Account Holder/Admin/App Manager).

### 3. App ID, Bundle ID, and Signing Strategy
- Confirm final bundle ID strategy (`com.agents-ui.desktop` or renamed production ID).
- Create/verify App ID in Apple Developer portal.
- Set up certificates for Mac App Distribution.
- Set up provisioning profiles for App Store distribution.

### 4. Tauri macOS Hardening and Entitlements
- Audit current capabilities and permissions for Mac App Store compliance.
- Review network, file system, shell/process, and plugin usage for sandbox compatibility.
- Configure entitlements for required runtime behavior only.
- Remove or gate any non-MAS-compatible features (if needed).

### 5. Build and Packaging Pipeline
- Create reproducible macOS release build command.
- Generate signed `.app` / `.pkg` artifact suitable for App Store upload.
- Add CI workflow (GitHub Actions) for build validation and release artifact generation.
- Add versioning and changelog policy.

### 6. App Store Connect Setup
- Create app record with final metadata.
- Upload app binary via Transporter/Xcode tooling.
- Set age rating, content rights, export compliance, and privacy labels.
- Configure TestFlight/internal testing track for pre-submission QA.

### 7. QA and Compliance Validation
- Execute smoke/regression test pass on Apple Silicon and Intel macOS if supported.
- Validate install/launch/update and core terminal/task/session workflows.
- Validate sandbox-sensitive functionality under distribution build.
- Document known limitations and mitigation.

### 8. Submission and Launch Operations
- Prepare submission checklist and go/no-go criteria.
- Submit for App Review and handle review feedback loop.
- Prepare launch-day monitoring and rollback/patch procedure.

## Child Task Breakdown (Execution Queue)

1. **T1 - Mac App Store release requirements audit**
   - Scope: gap analysis between current app and MAS requirements.
   - Output: requirements checklist + blockers list.

2. **T2 - Apple account, legal, and App Store Connect readiness**
   - Scope: account roles, agreements, tax/banking, app record prerequisites.
   - Output: readiness report with ownership assignments.

3. **T3 - Bundle ID, signing certificates, and provisioning setup**
   - Scope: define production identifiers and signing assets.
   - Output: documented signing matrix and secure storage process.

4. **T4 - Tauri macOS sandbox and entitlement configuration**
   - Scope: validate capabilities/plugins vs MAS constraints.
   - Output: entitlement spec + code/config changes list.

5. **T5 - Build and CI pipeline for Mac App Store artifacts**
   - Scope: deterministic release build and CI checks.
   - Output: pipeline plan and implementation tasks.

6. **T6 - App Store listing metadata and policy assets**
   - Scope: copywriting, screenshots, support/privacy URLs, category/keywords.
   - Output: complete listing pack.

7. **T7 - QA test plan for MAS distribution build**
   - Scope: pre-submission test matrix and acceptance criteria.
   - Output: test plan with pass/fail gates.

8. **T8 - Submission runbook and post-launch operations**
   - Scope: submission steps, reviewer response templates, post-launch monitoring.
   - Output: operational runbook.

## Dependency Order
1. T1 -> T2/T3/T4
2. T3 + T4 -> T5
3. T2 + T5 + T6 + T7 -> T8

## Definition of Done
- All T1-T8 child tasks exist under parent task `task_1770848505896_wa7ihbtnj`.
- Each child has clear objective and deliverables.
- Worker sessions spawned for each child task with an explicit reason.
- Plan document attached to task timeline in Maestro.
