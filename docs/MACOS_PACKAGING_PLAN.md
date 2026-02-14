# Maestro macOS Packaging & Monetization Plan

## TL;DR — Fastest Path to Revenue

| Step | What | Time | Cost |
|------|------|------|------|
| 1 | Sign up for Apple Developer Program | 1 day | $99/year |
| 2 | Sign up for Lemon Squeezy (merchant of record) | 1 hour | Free (5% + $0.50 per txn) |
| 3 | Add license key validation to the Tauri app | 2-3 days | $0 |
| 4 | Code sign + notarize the .dmg | 1 day | $0 (part of Apple Dev) |
| 5 | Set up a landing page + checkout | 1-2 days | $0-20/month |
| 6 | Ship it | — | — |

**Total time: ~1 week. Total upfront cost: $99.**

---

## Current State (What You Already Have)

Your app is **90% ready to ship**:

- `.app` bundle: **72MB** (Tauri + React + sidecar server)
- `.dmg` installer: **28MB** already built at `maestro-ui/src-tauri/target/release/bundle/dmg/`
- Server sidecar: 55MB standalone Node.js binary (no Node install required by user)
- Bundled tools: tmux + nushell (both architectures)
- Build script: `scripts/prod-build.sh` already works end-to-end

**What's missing:**
1. Code signing & notarization (users get "app is damaged" without this)
2. License/subscription validation
3. Payment processing
4. Distribution (website + download)

---

## Option Comparison: How to Sell

### Option A: Lemon Squeezy (RECOMMENDED — Fastest)

**What it is:** Merchant of Record — they handle payments, tax, invoicing, VAT, refunds, everything. They also have **built-in license key management**.

**Why it's best for you:**
- Built-in license key API (activate, validate, deactivate) — no backend to build
- Handles global tax compliance (VAT, sales tax) — you don't deal with it
- Checkout pages included — no website payment integration needed
- 5% + $0.50 per transaction (competitive for MoR)
- Free to start, no monthly fee
- Supports subscriptions AND one-time purchases
- License keys auto-generated on purchase

**License validation flow:**
```
User purchases → Lemon Squeezy generates license key → User enters key in app
                                                              ↓
App calls POST https://api.lemonsqueezy.com/v1/licenses/activate
                                                              ↓
On each app launch: POST https://api.lemonsqueezy.com/v1/licenses/validate
                                                              ↓
If expired/revoked → show "renew subscription" prompt
If valid → app works normally
If offline → grace period (e.g., 7 days since last successful validation)
```

**Docs:** https://docs.lemonsqueezy.com/api/license-api

### Option B: Paddle

**What it is:** Another Merchant of Record, historically strong for Mac apps.

- Also handles tax, licensing, subscriptions
- Has a native Mac SDK for license activation
- 5% + $0.50 per transaction
- More enterprise-focused, slightly more complex setup
- Paddle Billing (new) has weaker license key support than Classic

**Verdict:** Good but Lemon Squeezy is simpler for indie/startup.

### Option C: Stripe + Keygen.sh

**What it is:** DIY approach — Stripe for payments, Keygen for license management.

- Stripe: 2.9% + $0.30 per transaction (cheaper per-txn but YOU handle tax)
- Keygen: Free up to 100 users, then $49/month+
- More control, more work
- You become responsible for tax compliance (use Stripe Tax = extra 0.5%)

**Verdict:** More work, cheaper at scale, but tax compliance is a headache.

### Option D: Mac App Store

- Apple takes 30% (15% for small business < $1M/year)
- No license key management needed (Apple handles it)
- Sandboxing restrictions may break PTY/terminal features
- Review process can reject or delay releases
- No direct customer relationship

**Verdict:** Bad fit — your app needs system access (PTY, file system, shell) that App Store sandboxing restricts. Also 30% cut is brutal.

### Recommendation: **Lemon Squeezy**

Fastest to revenue. Built-in license keys. No tax headaches. Free to start.

---

## Implementation Plan

### Phase 1: Code Signing & Notarization (Day 1)

**Prerequisites:**
1. Apple Developer Program membership ($99/year) — https://developer.apple.com/programs/
2. Create a "Developer ID Application" certificate in Certificates, Identifiers & Profiles
3. Create an App Store Connect API key for notarization

**Tauri environment variables to set:**
```bash
# Code Signing
export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAMID)"

# Notarization (API Key method — recommended)
export APPLE_API_KEY="/path/to/AuthKey_KEYID.p8"
export APPLE_API_KEY_ID="KEYID"
export APPLE_API_ISSUER="issuer-uuid"
```

**Update `tauri.conf.prod.json`:**
```json
{
  "productName": "Maestro",
  "identifier": "com.maestro.app",
  "app": {
    "windows": [{ "label": "main", "title": "Maestro" }]
  },
  "bundle": {
    "externalBin": ["binaries/maestro-server"],
    "macOS": {
      "signingIdentity": "Developer ID Application: Your Name (TEAMID)",
      "hardenedRuntime": true,
      "minimumSystemVersion": "11.0",
      "entitlements": "Entitlements.plist"
    }
  }
}
```

**Create `maestro-ui/src-tauri/Entitlements.plist`:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.network.client</key>
    <true/>
    <key>com.apple.security.network.server</key>
    <true/>
    <key>com.apple.security.files.user-selected.read-write</key>
    <true/>
</dict>
</plist>
```

**Important:** There's a known Tauri issue with signing external binaries (sidecars). The maestro-server binary must also be signed. Update `prod-build.sh` to sign the sidecar before the Tauri build:
```bash
# After building server binary, sign it
codesign --force --options runtime \
  --sign "Developer ID Application: Your Name (TEAMID)" \
  maestro-ui/src-tauri/binaries/maestro-server-aarch64-apple-darwin
```

**Reference:** https://v2.tauri.app/distribute/sign/macos/

---

### Phase 2: License Key Validation in the App (Days 2-4)

#### Architecture

```
┌─────────────────────────────────────────────────┐
│  Maestro Desktop App (Tauri)                     │
│                                                   │
│  On first launch:                                 │
│    → Show license key input screen                │
│    → POST /v1/licenses/activate to Lemon Squeezy  │
│    → Store license key + instance_id in keyring    │
│                                                   │
│  On every launch:                                 │
│    → POST /v1/licenses/validate to Lemon Squeezy   │
│    → If valid: proceed to app                      │
│    → If expired: show renewal prompt               │
│    → If offline: check last_validated timestamp     │
│      → Within 7 days: proceed (grace period)       │
│      → Beyond 7 days: show "connect to validate"   │
│                                                   │
│  License data stored in:                           │
│    → macOS Keychain (via keyring crate)            │
│    → ~/.maestro/license.json (non-sensitive cache) │
└─────────────────────────────────────────────────┘
```

#### Rust Side (Tauri Commands)

You already have the `keyring` and `chacha20poly1305` crates. Add license validation as Tauri commands:

**New file: `maestro-ui/src-tauri/src/license.rs`**

```rust
use serde::{Deserialize, Serialize};
use keyring::Entry;
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

const STORE_ID: u64 = YOUR_LEMON_SQUEEZY_STORE_ID;
const PRODUCT_ID: u64 = YOUR_LEMON_SQUEEZY_PRODUCT_ID;
const GRACE_PERIOD_SECS: u64 = 7 * 24 * 60 * 60; // 7 days

#[derive(Serialize, Deserialize, Clone)]
pub struct LicenseState {
    pub license_key: String,
    pub instance_id: String,
    pub valid: bool,
    pub status: String, // "active", "expired", "disabled"
    pub customer_name: Option<String>,
    pub last_validated: u64,  // unix timestamp
}

#[derive(Deserialize)]
struct LemonSqueezyResponse {
    valid: bool,
    error: Option<String>,
    license_key: Option<LicenseKeyData>,
    instance: Option<InstanceData>,
    meta: Option<MetaData>,
}

#[derive(Deserialize)]
struct LicenseKeyData {
    id: u64,
    status: String,
    key: String,
    activation_limit: Option<u32>,
    activation_usage: u32,
}

#[derive(Deserialize)]
struct InstanceData {
    id: String,
    name: String,
}

#[derive(Deserialize)]
struct MetaData {
    store_id: u64,
    product_id: u64,
    customer_name: Option<String>,
}

fn get_license_cache_path() -> PathBuf {
    let home = dirs::home_dir().unwrap();
    home.join(".maestro").join("license.json")
}

fn save_to_keyring(license_key: &str, instance_id: &str) -> Result<(), String> {
    let entry = Entry::new("com.maestro.app", "license_key")
        .map_err(|e| e.to_string())?;
    entry.set_password(&format!("{}:{}", license_key, instance_id))
        .map_err(|e| e.to_string())?;
    Ok(())
}

fn load_from_keyring() -> Result<(String, String), String> {
    let entry = Entry::new("com.maestro.app", "license_key")
        .map_err(|e| e.to_string())?;
    let stored = entry.get_password().map_err(|e| e.to_string())?;
    let parts: Vec<&str> = stored.splitn(2, ':').collect();
    if parts.len() != 2 {
        return Err("Invalid stored license data".to_string());
    }
    Ok((parts[0].to_string(), parts[1].to_string()))
}

fn save_license_cache(state: &LicenseState) {
    if let Ok(json) = serde_json::to_string_pretty(state) {
        let path = get_license_cache_path();
        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        let _ = fs::write(path, json);
    }
}

fn load_license_cache() -> Option<LicenseState> {
    let path = get_license_cache_path();
    let data = fs::read_to_string(path).ok()?;
    serde_json::from_str(&data).ok()
}

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs()
}

#[tauri::command]
pub async fn activate_license(license_key: String) -> Result<LicenseState, String> {
    let client = reqwest::Client::new();
    let hostname = hostname::get()
        .map(|h| h.to_string_lossy().to_string())
        .unwrap_or_else(|_| "unknown".to_string());

    let resp = client
        .post("https://api.lemonsqueezy.com/v1/licenses/activate")
        .json(&serde_json::json!({
            "license_key": license_key,
            "instance_name": hostname
        }))
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    let body: LemonSqueezyResponse = resp.json().await
        .map_err(|e| format!("Parse error: {}", e))?;

    if !body.valid {
        return Err(body.error.unwrap_or("Invalid license key".to_string()));
    }

    // Verify this is for OUR product
    if let Some(meta) = &body.meta {
        if meta.store_id != STORE_ID || meta.product_id != PRODUCT_ID {
            return Err("License key is not for this product".to_string());
        }
    }

    let instance_id = body.instance
        .map(|i| i.id)
        .ok_or("No instance ID returned")?;

    let state = LicenseState {
        license_key: license_key.clone(),
        instance_id: instance_id.clone(),
        valid: true,
        status: body.license_key.map(|lk| lk.status).unwrap_or("active".to_string()),
        customer_name: body.meta.and_then(|m| m.customer_name),
        last_validated: now_secs(),
    };

    save_to_keyring(&license_key, &instance_id)?;
    save_license_cache(&state);

    Ok(state)
}

#[tauri::command]
pub async fn validate_license() -> Result<LicenseState, String> {
    // Try loading from keyring first
    let (license_key, instance_id) = match load_from_keyring() {
        Ok(data) => data,
        Err(_) => return Err("no_license".to_string()),
    };

    let client = reqwest::Client::new();
    let resp = client
        .post("https://api.lemonsqueezy.com/v1/licenses/validate")
        .json(&serde_json::json!({
            "license_key": license_key,
            "instance_id": instance_id
        }))
        .send()
        .await;

    match resp {
        Ok(response) => {
            let body: LemonSqueezyResponse = response.json().await
                .map_err(|e| format!("Parse error: {}", e))?;

            if let Some(meta) = &body.meta {
                if meta.store_id != STORE_ID || meta.product_id != PRODUCT_ID {
                    return Err("License key is not for this product".to_string());
                }
            }

            let state = LicenseState {
                license_key,
                instance_id,
                valid: body.valid,
                status: body.license_key.map(|lk| lk.status).unwrap_or("unknown".to_string()),
                customer_name: body.meta.and_then(|m| m.customer_name),
                last_validated: now_secs(),
            };

            save_license_cache(&state);
            Ok(state)
        }
        Err(_) => {
            // Offline — use grace period
            if let Some(cached) = load_license_cache() {
                let elapsed = now_secs() - cached.last_validated;
                if elapsed < GRACE_PERIOD_SECS && cached.valid {
                    return Ok(cached);
                }
                return Err("offline_expired".to_string());
            }
            Err("offline_no_cache".to_string())
        }
    }
}

#[tauri::command]
pub async fn deactivate_license() -> Result<(), String> {
    let (license_key, instance_id) = load_from_keyring()?;

    let client = reqwest::Client::new();
    let _ = client
        .post("https://api.lemonsqueezy.com/v1/licenses/deactivate")
        .json(&serde_json::json!({
            "license_key": license_key,
            "instance_id": instance_id
        }))
        .send()
        .await;

    // Clean up local state regardless
    let entry = Entry::new("com.maestro.app", "license_key")
        .map_err(|e| e.to_string())?;
    let _ = entry.delete_credential();
    let _ = fs::remove_file(get_license_cache_path());

    Ok(())
}

#[tauri::command]
pub fn get_license_status() -> Result<Option<LicenseState>, String> {
    Ok(load_license_cache())
}
```

**Add `reqwest` and `hostname` to `Cargo.toml`:**
```toml
[dependencies]
reqwest = { version = "0.12", features = ["json"] }
hostname = "0.4"
```

**Register commands in `main.rs`:**
```rust
mod license;

// In the builder:
.invoke_handler(tauri::generate_handler![
    // ... existing commands ...
    license::activate_license,
    license::validate_license,
    license::deactivate_license,
    license::get_license_status,
])
```

#### Frontend Side (React)

**New component: `LicenseGate.tsx`**

```tsx
import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface LicenseState {
  license_key: string;
  instance_id: string;
  valid: boolean;
  status: string;
  customer_name: string | null;
  last_validated: number;
}

export function LicenseGate({ children }: { children: React.ReactNode }) {
  const [checking, setChecking] = useState(true);
  const [licensed, setLicensed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState('');
  const [activating, setActivating] = useState(false);

  useEffect(() => {
    checkLicense();
  }, []);

  async function checkLicense() {
    try {
      const state = await invoke<LicenseState>('validate_license');
      if (state.valid) {
        setLicensed(true);
      } else {
        setError(`License ${state.status}. Please renew your subscription.`);
      }
    } catch (err: any) {
      if (err === 'no_license') {
        setError(null); // Show activation form
      } else if (err === 'offline_expired') {
        setError('Your license could not be verified. Please connect to the internet.');
      } else {
        setError(String(err));
      }
    } finally {
      setChecking(false);
    }
  }

  async function handleActivate() {
    setActivating(true);
    setError(null);
    try {
      const state = await invoke<LicenseState>('activate_license', {
        licenseKey: keyInput.trim()
      });
      if (state.valid) {
        setLicensed(true);
      }
    } catch (err: any) {
      setError(String(err));
    } finally {
      setActivating(false);
    }
  }

  if (checking) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h2>Maestro</h2>
          <p>Checking license...</p>
        </div>
      </div>
    );
  }

  if (licensed) {
    return <>{children}</>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Maestro</h1>
        <p style={styles.subtitle}>Multi-Agent Orchestration for Claude AI</p>

        <div style={styles.form}>
          <label style={styles.label}>License Key</label>
          <input
            type="text"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
            style={styles.input}
            onKeyDown={(e) => e.key === 'Enter' && handleActivate()}
          />
          <button
            onClick={handleActivate}
            disabled={activating || !keyInput.trim()}
            style={styles.button}
          >
            {activating ? 'Activating...' : 'Activate License'}
          </button>
        </div>

        {error && <p style={styles.error}>{error}</p>}

        <a
          href="https://YOUR_STORE.lemonsqueezy.com"
          target="_blank"
          style={styles.link}
        >
          Don't have a license? Purchase here
        </a>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: '100vh', background: '#0a0a0a',
  },
  card: {
    background: '#1a1a1a', borderRadius: 12, padding: 48,
    maxWidth: 420, width: '100%', textAlign: 'center',
    border: '1px solid #333',
  },
  title: { color: '#fff', margin: 0, fontSize: 28 },
  subtitle: { color: '#888', fontSize: 14, marginBottom: 32 },
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  label: { color: '#ccc', textAlign: 'left', fontSize: 13 },
  input: {
    padding: '10px 14px', borderRadius: 8, border: '1px solid #444',
    background: '#111', color: '#fff', fontSize: 14, fontFamily: 'monospace',
  },
  button: {
    padding: '10px 20px', borderRadius: 8, border: 'none',
    background: '#2563eb', color: '#fff', fontSize: 14,
    cursor: 'pointer', marginTop: 8,
  },
  error: { color: '#ef4444', fontSize: 13, marginTop: 12 },
  link: { color: '#60a5fa', fontSize: 13, marginTop: 16, display: 'block' },
};
```

**Wrap your app root:**
```tsx
// In App.tsx or main entry
<LicenseGate>
  <YourExistingApp />
</LicenseGate>
```

---

### Phase 3: Lemon Squeezy Setup (Day 3)

1. **Create account** at https://lemonsqueezy.com
2. **Create a Store** (e.g., "Maestro")
3. **Create a Product:**
   - Name: "Maestro Pro"
   - Type: "Software License"
   - Enable license key generation
   - Set activation limit: 2 (desktop + 1 spare)
   - Set license length: Subscription-linked (expires when subscription ends)
4. **Create Variants (pricing tiers):**
   - **Monthly**: $29/month
   - **Annual**: $249/year (save ~28%)
5. **Note your IDs**: Store ID, Product ID → hardcode into `license.rs`
6. **Customize checkout page** (branding, colors)
7. **Set up webhooks** (optional, for analytics)

---

### Phase 4: Distribution (Days 4-5)

#### Option A: Simple Landing Page (Fastest)

Use any of these:
- **Carrd.co** ($19/year) — single-page site
- **Framer** (free tier) — nicer design
- **GitHub Pages** (free) — markdown site

Content needed:
- Hero: "Orchestrate multiple Claude AI agents like a conductor"
- Demo video/GIF (30-60 seconds)
- Feature list
- Pricing
- "Buy Now" button → Lemon Squeezy checkout overlay
- Download link (post-purchase, Lemon Squeezy handles this)

#### Option B: Lemon Squeezy Hosted (Even Faster)

Lemon Squeezy gives you a hosted product page automatically:
`https://your-store.lemonsqueezy.com/buy/product-id`

You can share this link directly — no website needed on day 1.

#### DMG Distribution

After purchase, the user gets:
1. License key (via email from Lemon Squeezy)
2. Download link for the `.dmg` file

You can host the DMG on:
- **Lemon Squeezy** (digital product delivery, built-in)
- **GitHub Releases** (free, reliable CDN)
- **Cloudflare R2** (free egress, $0.015/GB storage)

---

### Phase 5: Updated Build Script

**Updated `scripts/prod-build.sh`:**

```bash
#!/bin/bash
set -e

APP_NAME="Maestro"
APP_BUNDLE="$APP_NAME.app"
VERSION="1.0.0"
BUILD_OUTPUT="maestro-ui/src-tauri/target/release/bundle/macos/$APP_BUNDLE"
DMG_OUTPUT="maestro-ui/src-tauri/target/release/bundle/dmg"

echo "=== Maestro Production Build v$VERSION ==="

# 1. Kill any running instance
echo ""
echo "[1/6] Stopping running instances..."
pkill -f "$APP_NAME" 2>/dev/null && echo "  Killed running app." || echo "  No running instance found."
sleep 1

# 2. Clean
echo ""
echo "[2/6] Cleaning old builds..."
rm -rf "$BUILD_OUTPUT"
rm -rf "$DMG_OUTPUT"

# 3. Build server binary
echo ""
echo "[3/6] Building server..."
npm run build:server
cd maestro-server && npm run build:binary && cd ..

# 4. Sign the sidecar binary (REQUIRED for notarization)
echo ""
echo "[4/6] Signing sidecar binary..."
codesign --force --options runtime \
  --sign "$APPLE_SIGNING_IDENTITY" \
  maestro-ui/src-tauri/binaries/maestro-server-aarch64-apple-darwin

# 5. Build Tauri app (code signing + notarization handled by Tauri)
echo ""
echo "[5/6] Building Tauri app (signing + notarizing)..."
cd maestro-ui
VITE_API_URL=http://localhost:2357/api \
VITE_WS_URL=ws://localhost:2357 \
  npx tauri build --features custom-protocol --config src-tauri/tauri.conf.prod.json
cd ..

# 6. Output
echo ""
echo "[6/6] Build complete!"
echo "  .app: $BUILD_OUTPUT"
echo "  .dmg: $(ls $DMG_OUTPUT/*.dmg 2>/dev/null)"
echo ""
echo "Upload the .dmg to Lemon Squeezy or your distribution channel."
```

---

## Pricing Strategy

### Recommended: Simple Two-Tier

| | **Pro** | **Team** |
|---|---|---|
| Price | $29/mo or $249/yr | $99/mo or $899/yr |
| Seats | 1 | 5 |
| Concurrent sessions | 10 | Unlimited |
| Updates | Included | Included |
| Support | Email | Priority |

**Why this works:**
- $29/month is the sweet spot for dev tools (same as Linear, Raycast Pro, etc.)
- Annual discount incentivizes commitment + improves cash flow
- Team tier captures small team budgets without enterprise sales complexity

### Alternative: One-Time Purchase

| | **License** | **License + Updates** |
|---|---|---|
| Price | $199 | $299/year |
| What you get | Current version forever | Current + all future updates |

This works if your audience hates subscriptions, but recurring revenue is better for you.

---

## Free Trial Strategy

**Option 1: 14-day trial (no credit card)**
- User downloads app, uses it free for 14 days
- After 14 days, must enter license key
- Implementation: Check `first_launch_date` stored locally

**Option 2: Feature-gated free tier**
- Free: 1 project, 3 sessions max
- Pro: Unlimited
- More complex to implement but better conversion funnel

**Recommendation:** Start with 14-day trial. Simple to implement, creates urgency.

```rust
// In license.rs — add trial support
const TRIAL_DAYS: u64 = 14;

#[tauri::command]
pub fn check_trial() -> Result<TrialState, String> {
    let path = dirs::home_dir().unwrap().join(".maestro").join("trial.json");

    if !path.exists() {
        // First launch — start trial
        let state = TrialState {
            started: now_secs(),
            days_remaining: TRIAL_DAYS,
            expired: false,
        };
        let json = serde_json::to_string(&state).unwrap();
        fs::write(&path, json).map_err(|e| e.to_string())?;
        return Ok(state);
    }

    let data = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mut state: TrialState = serde_json::from_str(&data).map_err(|e| e.to_string())?;

    let elapsed_days = (now_secs() - state.started) / 86400;
    state.days_remaining = TRIAL_DAYS.saturating_sub(elapsed_days);
    state.expired = elapsed_days >= TRIAL_DAYS;

    Ok(state)
}
```

---

## Universal Binary (Intel + Apple Silicon)

Your current build is **arm64 only**. To support Intel Macs:

```bash
# Build server binary for both architectures
# In maestro-server/package.json, add:
"build:binary:x86": "npx pkg dist/server.js --targets node20-macos-x64 --output ../maestro-ui/src-tauri/binaries/maestro-server-x86_64-apple-darwin"

# Build universal Tauri binary
cd maestro-ui
npx tauri build --target universal-apple-darwin --features custom-protocol --config src-tauri/tauri.conf.prod.json
```

This creates a single `.dmg` that works on both Intel and Apple Silicon Macs.

**Note:** You'll also need x86_64 versions of tmux and nushell in the `bin/` directory (which you already have).

---

## Auto-Updates (Optional but Recommended)

Tauri v2 has built-in update support. This lets users get updates without re-downloading.

**Add to `tauri.conf.prod.json`:**
```json
{
  "plugins": {
    "updater": {
      "endpoints": ["https://your-domain.com/api/updates/{{target}}/{{arch}}/{{current_version}}"],
      "pubkey": "YOUR_PUBLIC_KEY"
    }
  }
}
```

You can host the update manifest on GitHub Releases or a simple static JSON file. This is a nice-to-have for v1.1, not a blocker for launch.

---

## Complete Checklist

### Before First Sale

- [ ] Apple Developer Program ($99) — enroll
- [ ] Create Developer ID Application certificate
- [ ] Create App Store Connect API key (for notarization)
- [ ] Lemon Squeezy account — create
- [ ] Lemon Squeezy product + pricing — configure
- [ ] `license.rs` — implement license validation
- [ ] `LicenseGate.tsx` — implement UI gate
- [ ] Update `Cargo.toml` — add `reqwest`, `hostname`
- [ ] Update `main.rs` — register license commands
- [ ] Update `tauri.conf.prod.json` — signing config
- [ ] Create `Entitlements.plist`
- [ ] Update `prod-build.sh` — add signing steps
- [ ] Build signed + notarized `.dmg`
- [ ] Test on a clean Mac (no dev tools installed)
- [ ] Upload `.dmg` to Lemon Squeezy
- [ ] Landing page or share Lemon Squeezy checkout link
- [ ] Terms of Service + Privacy Policy (use generators like Termly.io)

### Nice-to-Have (Post-Launch)

- [ ] Universal binary (Intel + ARM)
- [ ] Auto-update mechanism
- [ ] Usage analytics (PostHog)
- [ ] Error reporting (Sentry)
- [ ] Feature-gated free tier
- [ ] CLI license validation (`maestro activate <key>`)
- [ ] Referral program
- [ ] Team license management dashboard

---

## Revenue Projections (Conservative)

| Month | Users | Paying | MRR |
|-------|-------|--------|-----|
| 1 | 50 | 5 | $145 |
| 3 | 200 | 30 | $870 |
| 6 | 500 | 75 | $2,175 |
| 12 | 2,000 | 200 | $5,800 |

At 10% conversion (good for dev tools with trial), 200 paying users at $29/mo = **$5,800 MRR = ~$70K ARR**.

Lemon Squeezy takes 5% + $0.50/txn, so your net on $29 = ~$27.05/user/month.

---

## Summary

**Do this, in this order:**

1. **Day 1:** Apple Developer enrollment + Lemon Squeezy setup
2. **Days 2-3:** Implement `license.rs` + `LicenseGate.tsx`
3. **Day 4:** Code signing + notarization + build
4. **Day 5:** Landing page + upload DMG + test purchase flow
5. **Day 6:** Launch on Twitter/X, r/ClaudeAI, Hacker News
6. **Day 7:** First sale

The key insight: **you already have a working app**. The gap between "working app" and "sellable product" is just code signing + license validation + a checkout page. That's ~1 week of work.
