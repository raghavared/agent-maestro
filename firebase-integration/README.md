# Firebase Integration

Maestro moves to the cloud. Data lives in Firebase. Desktop and phone share one truth.

## Documents

| Doc | Purpose |
|-----|---------|
| [00-PHILOSOPHY.md](./00-PHILOSOPHY.md) | Design principles and why Firebase |
| [01-ARCHITECTURE.md](./01-ARCHITECTURE.md) | System architecture and data flow |
| [02-DATA-MODEL.md](./02-DATA-MODEL.md) | Firestore, RTDB, and Storage schemas |
| [03-SYNC-ENGINE.md](./03-SYNC-ENGINE.md) | Online/offline sync strategy |
| [04-AUTH.md](./04-AUTH.md) | Authentication and security rules |
| [05-MIGRATION.md](./05-MIGRATION.md) | Step-by-step migration from filesystem |
| [06-MOBILE.md](./06-MOBILE.md) | Phone app with shared React code |
| [07-CLOUD-FUNCTIONS.md](./07-CLOUD-FUNCTIONS.md) | Background jobs and triggers |

## The Shape of It

```
Desktop (Tauri)  ──┐
                   ├──  Firebase  ──  One truth, everywhere
Phone (React)    ──┘

Offline? Write locally. Online? Sync instantly. Always consistent.
```
