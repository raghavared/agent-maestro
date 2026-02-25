# Lemon Squeezy Integration — Agent Maestro

How to add license key monetization to the Tauri desktop app using Lemon Squeezy.

---

## What You're Selling

A **freemium desktop app** — free tier allows up to 3 projects, licensed tier is unlimited.

Recommended pricing:
- **One-time**: $29 — Activations: 1-3 (multi-machine)
- **Subscription**: $9/month — Activations: 1

**Why freemium over hard-gating the whole app:** users experience the product before paying, which converts much better than a paywall on launch.

---

## Freemium Model

| Tier | Projects | Sessions | Tasks |
|------|----------|----------|-------|
| Free | 3 | Unlimited | Unlimited |
| Licensed | Unlimited | Unlimited | Unlimited |

The limit is enforced **server-side** in `ProjectService.createProject` — it cannot be bypassed by poking the UI.

---

## Step 1: Set Up Lemon Squeezy

1. Create account at lemonsqueezy.com
2. Create a **Store** → Add a **Product** → Set type to **"License key"**
3. Create two variants: one-time ($29) and subscription ($9/mo)
4. Note your **API key** from Settings → API

---

## Step 2: Add License Routes to Express Server

Create `maestro-server/src/api/licenseRoutes.ts`:

```typescript
import { Router, Request, Response } from 'express';
import { writeFileSync, readFileSync, mkdirSync } from 'fs';
import { join } from 'path';

export function createLicenseRoutes(dataDir: string): Router {
  const router = Router();
  const licenseFile = join(dataDir, 'license.json');

  // GET /api/license/status — read cached license from disk
  router.get('/license/status', (req: Request, res: Response) => {
    try {
      const data = JSON.parse(readFileSync(licenseFile, 'utf-8'));
      return res.json({ licensed: data.status === 'active', license: data });
    } catch {
      return res.json({ licensed: false });
    }
  });

  // POST /api/license/validate
  router.post('/license/validate', async (req: Request, res: Response) => {
    const { licenseKey, instanceName } = req.body;
    if (!licenseKey) return res.status(400).json({ error: 'licenseKey required' });

    try {
      const response = await fetch('https://api.lemonsqueezy.com/v1/licenses/validate', {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          license_key: licenseKey,
          instance_name: instanceName ?? 'Agent Maestro',
        }),
      });

      const data = await response.json() as any;

      if (!response.ok || !data.valid) {
        return res.status(403).json({ valid: false, error: data.error ?? 'Invalid license' });
      }

      return res.json({
        valid: true,
        license: {
          key: licenseKey,
          status: data.license_key.status,
          activationLimit: data.license_key.activation_limit,
          activationsUsed: data.license_key.activations_count,
        },
      });
    } catch (err) {
      return res.status(500).json({ valid: false, error: 'Failed to reach license server' });
    }
  });

  // POST /api/license/activate — activates and persists license to disk
  router.post('/license/activate', async (req: Request, res: Response) => {
    const { licenseKey, instanceName } = req.body;
    if (!licenseKey) return res.status(400).json({ error: 'licenseKey required' });

    try {
      const response = await fetch('https://api.lemonsqueezy.com/v1/licenses/activate', {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          license_key: licenseKey,
          instance_name: instanceName ?? `Agent Maestro – ${Date.now()}`,
        }),
      });

      const data = await response.json() as any;

      if (!response.ok || !data.activated) {
        return res.status(403).json({ activated: false, error: data.error ?? 'Activation failed' });
      }

      // Persist license to disk so ProjectService can read it
      const licenseData = {
        key: licenseKey,
        instanceId: data.instance.id,
        status: data.license_key.status,
        activatedAt: new Date().toISOString(),
      };
      mkdirSync(dataDir, { recursive: true });
      writeFileSync(licenseFile, JSON.stringify(licenseData, null, 2));

      return res.json({
        activated: true,
        instanceId: data.instance.id,
        license: { key: licenseKey, status: data.license_key.status },
      });
    } catch (err) {
      return res.status(500).json({ activated: false, error: 'Failed to reach license server' });
    }
  });

  // POST /api/license/deactivate
  router.post('/license/deactivate', async (req: Request, res: Response) => {
    const { licenseKey, instanceId } = req.body;
    if (!licenseKey || !instanceId) return res.status(400).json({ error: 'licenseKey and instanceId required' });

    try {
      const response = await fetch('https://api.lemonsqueezy.com/v1/licenses/deactivate', {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ license_key: licenseKey, instance_id: instanceId }),
      });

      const data = await response.json() as any;

      // Clear license file on deactivation
      if (data.deactivated) {
        try { writeFileSync(licenseFile, JSON.stringify({ status: 'inactive' })); } catch {}
      }

      return res.json({ deactivated: data.deactivated ?? false });
    } catch (err) {
      return res.status(500).json({ deactivated: false });
    }
  });

  return router;
}
```

Register in `maestro-server/src/server.ts`:
```typescript
import { createLicenseRoutes } from './api/licenseRoutes';
// ...
app.use('/api', createLicenseRoutes(config.dataDir));
```

---

## Step 3: Enforce the Project Limit in ProjectService

`ProjectService` already has `getProjectCount()`. Add the limit check in `createProject` and inject `dataDir`.

**`maestro-server/src/application/services/ProjectService.ts`** — update constructor and `createProject`:

```typescript
import { readFileSync } from 'fs';
import { join } from 'path';

const FREE_PROJECT_LIMIT = 3;

export class ProjectService {
  constructor(
    private projectRepo: IProjectRepository,
    private eventBus: IEventBus,
    private dataDir: string   // add this
  ) {}

  async createProject(input: CreateProjectInput): Promise<Project> {
    if (!input.name || input.name.trim() === '') {
      throw new ValidationError('Project name is required');
    }

    // Freemium gate — enforce project limit for unlicensed users
    const count = await this.projectRepo.count();
    if (count >= FREE_PROJECT_LIMIT && !this.isLicensed()) {
      throw new BusinessRuleError(
        `Free tier is limited to ${FREE_PROJECT_LIMIT} projects. Activate a license to create unlimited projects.`,
        'PROJECT_LIMIT_REACHED'
      );
    }

    const project = await this.projectRepo.create({
      name: input.name.trim(),
      workingDir: input.workingDir || '',
      description: input.description || '',
    });

    await this.eventBus.emit('project:created', project);
    return project;
  }

  private isLicensed(): boolean {
    try {
      const data = JSON.parse(readFileSync(join(this.dataDir, 'license.json'), 'utf-8'));
      return data.status === 'active';
    } catch {
      return false; // no license file = free tier
    }
  }

  // ... rest of service unchanged
}
```

Wire it in `container.ts`:
```typescript
const projectService = new ProjectService(projectRepo, eventBus, config.dataDir);
```

---

## Step 4: Add `code` Field to BusinessRuleError

Check `maestro-server/src/domain/common/Errors.ts` and ensure `BusinessRuleError` supports a machine-readable code the UI can key off:

```typescript
export class BusinessRuleError extends AppError {
  constructor(message: string, public readonly code = 'BUSINESS_RULE_ERROR') {
    super(message, 422);
  }

  toJSON() {
    return { error: true, message: this.message, code: this.code };
  }
}
```

---

## Step 5: Store License Key in Tauri Persisted State

Add fields to `PersistedStateV1` in `maestro-ui/src-tauri/src/persist.rs` so the UI remembers the key across restarts:

```rust
#[serde(default, skip_serializing_if = "Option::is_none")]
pub license_key: Option<String>,
#[serde(default, skip_serializing_if = "Option::is_none")]
pub license_instance_id: Option<String>,
```

Uses existing `state-v1.json` — no new storage mechanism needed.

---

## Step 6: React License Hook

Create `maestro-ui/src/hooks/useLicense.ts`:

```typescript
import { useState, useEffect } from 'react';

export type LicenseStatus = 'checking' | 'licensed' | 'unlicensed';

export function useLicense() {
  const [status, setStatus] = useState<LicenseStatus>('checking');

  useEffect(() => { checkLicense(); }, []);

  async function checkLicense() {
    try {
      const res = await fetch('http://localhost:2357/api/license/status');
      const data = await res.json();
      setStatus(data.licensed ? 'licensed' : 'unlicensed');
    } catch {
      setStatus('unlicensed'); // server offline
    }
  }

  async function activate(key: string): Promise<{ activated: boolean; error?: string }> {
    const res = await fetch('http://localhost:2357/api/license/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ licenseKey: key }),
    });
    const data = await res.json();
    if (data.activated) {
      // Also save key to Tauri persisted state for display in settings
      const state = await window.__TAURI__.core.invoke('load_persisted_state');
      await window.__TAURI__.core.invoke('save_persisted_state', {
        state: { ...state, licenseKey: key, licenseInstanceId: data.instanceId },
      });
      setStatus('licensed');
    }
    return data;
  }

  return { status, activate };
}
```

---

## Step 7: Intercept PROJECT_LIMIT_REACHED in the UI

Wherever `POST /api/projects` is called, handle the limit error specifically:

```typescript
const res = await fetch('http://localhost:2357/api/projects', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name, workingDir }),
});

if (!res.ok) {
  const err = await res.json();
  if (err.code === 'PROJECT_LIMIT_REACHED') {
    setShowUpgradeModal(true);  // show upgrade prompt, not a generic error
    return;
  }
  throw new Error(err.message);
}
```

The upgrade modal:
- "You've used all 3 free projects"
- **"Buy License ($29)"** → opens Lemon Squeezy checkout via `@tauri-apps/plugin-shell`
- **"Enter License Key"** → input that calls `activate(key)`

```tsx
import { open } from '@tauri-apps/plugin-shell';

<button onClick={() => open('https://agentmaestro.lemonsqueezy.com')}>
  Buy License ($29 one-time)
</button>
```

---

## Step 8: Environment Variable

Add to prod server launch (`.env` or shell script):

```bash
LEMON_SQUEEZY_API_KEY=your_key_here
```

---

## Files to Touch

| File | Change |
|------|--------|
| `maestro-server/src/api/licenseRoutes.ts` | New file — validate/activate/deactivate + persist to disk |
| `maestro-server/src/server.ts` | Register license routes, pass `config.dataDir` |
| `maestro-server/src/application/services/ProjectService.ts` | Add `dataDir` param + `isLicensed()` + limit check in `createProject` |
| `maestro-server/src/domain/common/Errors.ts` | Add `code` field to `BusinessRuleError` |
| `maestro-server/src/container.ts` | Pass `config.dataDir` into `ProjectService` constructor |
| `maestro-ui/src-tauri/src/persist.rs` | Add `license_key` + `license_instance_id` to `PersistedStateV1` |
| `maestro-ui/src/hooks/useLicense.ts` | New React hook |
| UI (wherever `POST /projects` is called) | Catch `PROJECT_LIMIT_REACHED`, show upgrade modal |

---

## Key Design Decisions

- **Server-side enforcement** — limit check in `ProjectService.createProject`. Cannot be bypassed by UI manipulation.
- **License persisted to `~/.maestro/data/license.json`** — written by the server on activation, read by `ProjectService`. The server and UI share the same data dir.
- **Fail open offline** — `isLicensed()` reads from disk, not from Lemon Squeezy on every call. Validation happens at activation time only.
- **No CSP changes needed** — browser only talks to `localhost:2357`; Lemon Squeezy API calls happen server-side.
- **Freemium over hard gate** — users experience the full product on ≤3 projects before hitting the paywall. Converts better than blocking the app entirely.

---

## macOS Distribution (No App Store Needed)

Direct distribution via Lemon Squeezy — buyers get a download link automatically after purchase.

**What you need:**
- **Apple Developer account** ($99/year) — required for code signing and notarization
- **Developer ID Application certificate** (not the App Store certificate)

**Build & sign:**
```bash
# Set these env vars, then:
cd maestro-ui && bun run tauri build
# outputs: src-tauri/target/release/bundle/dmg/AgentMaestro_x.x.x_aarch64.dmg
```

Required env vars for signing + notarization:
```bash
APPLE_CERTIFICATE=...                  # base64-encoded .p12
APPLE_CERTIFICATE_PASSWORD=...
APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAMID)"
APPLE_ID=you@email.com
APPLE_PASSWORD=...                     # app-specific password from appleid.apple.com
APPLE_TEAM_ID=YOURTEAMID
```

Tauri runs `xcrun notarytool` automatically during `tauri build`. Upload the resulting `.dmg` to Lemon Squeezy as a product file.

**Do not use the Mac App Store:** 30% cut, Apple review delays, and sandboxing will likely break PTY sessions and subprocess spawning (Claude CLI, etc.).

---

## Launch Timeline

| Day | Action |
|-----|--------|
| 1 | Create Lemon Squeezy store, product, get API key |
| 2 | Add license routes to Express server (validate/activate/deactivate/status) |
| 3 | Add `isLicensed()` + limit check to `ProjectService`, wire `dataDir` in container |
| 4 | Add `code` to `BusinessRuleError`, build upgrade modal + `useLicense` hook |
| 5 | Set up Apple Developer account, configure signing env vars |
| 6 | End-to-end test: buy → receive key → activate → 4th project unlocks |
| 7 | Launch on Twitter/X, HN, Reddit r/SideProject |
