# Mobile App

## Strategy: One Codebase, Two Shells

The React code runs on desktop (Tauri) and phone (Capacitor). Same components. Same hooks. Same Firebase service layer. Only the native shell differs.

```
┌──────────────────────────────────────┐
│         Shared React Code            │
│                                      │
│  Components   Hooks   Stores   Utils │
│      │          │        │       │   │
│      └──────────┴────────┴───────┘   │
│                  │                   │
│          Firebase SDK                │
└──────────────────┬───────────────────┘
                   │
         ┌─────────┴─────────┐
         │                   │
    ┌────▼────┐        ┌────▼─────┐
    │  Tauri  │        │Capacitor │
    │(Desktop)│        │ (Phone)  │
    └─────────┘        └──────────┘
```

## Why Capacitor (Not React Native)

| Factor | Capacitor | React Native |
|--------|-----------|-------------|
| Code sharing with Tauri web app | 100% -- same React DOM code | 0% -- different component primitives |
| Learning curve | Zero -- it's the same code | High -- new component library |
| Firebase SDK | Standard web SDK | Separate RN Firebase package |
| Styling | Same CSS/Tailwind | StyleSheet API (different) |
| Build complexity | Wrap existing web app | Rewrite UI layer |

Capacitor wraps our existing React web app in a native iOS/Android shell. The web code runs in a WebView with native bridge access. This means:

- **Zero rewrite** of UI components
- **Same Tailwind CSS** styling
- **Same Zustand stores** and hooks
- **Same Firebase web SDK**

## Setup

```bash
# In maestro-ui directory
npm install @capacitor/core @capacitor/cli
npx cap init "Maestro" "com.maestro.app" --web-dir dist

# Add platforms
npx cap add ios
npx cap add android

# Build and sync
npm run build
npx cap sync
```

### Capacitor Config

```typescript
// capacitor.config.ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.maestro.app',
  appName: 'Maestro',
  webDir: 'dist',
  server: {
    // In development, load from Vite dev server
    url: process.env.NODE_ENV === 'development'
      ? 'http://localhost:5173'
      : undefined,
    cleartext: true  // dev only
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    }
  }
};

export default config;
```

## Responsive Design

The existing desktop UI needs responsive breakpoints. Not a rewrite -- just CSS.

```css
/* Mobile-first breakpoints */
@media (max-width: 768px) {
  .sidebar { display: none; }        /* hide sidebar, use bottom nav */
  .task-detail { width: 100%; }      /* full width on mobile */
  .session-grid { grid-columns: 1; } /* single column */
}
```

### Mobile-Specific Layout

```
Desktop:                          Mobile:
┌──────┬──────────────┐          ┌──────────────┐
│ Side │              │          │  Tab Bar Top  │
│ bar  │   Content    │          ├──────────────┤
│      │              │          │              │
│      │              │          │   Content    │
│      │              │          │   (full)     │
│      │              │          │              │
└──────┴──────────────┘          ├──────────────┤
                                 │ Bottom Nav   │
                                 └──────────────┘
```

### Platform Detection

```typescript
// src/utils/platform.ts
import { Capacitor } from '@capacitor/core';

export const isMobile = Capacitor.isNativePlatform();
export const isDesktop = !isMobile;
export const platform = Capacitor.getPlatform(); // 'ios' | 'android' | 'web'
```

Use this to conditionally render mobile vs desktop layouts:

```tsx
function AppLayout() {
  if (isMobile) return <MobileLayout />;
  return <DesktopLayout />;
}
```

## Mobile Features

### Phase 1: View & Monitor (MVP)

What you can do on your phone:

**Tasks**
- Browse projects and tasks
- View task details, status, history
- Create new tasks (quick input)
- Update task status (swipe gestures)
- Filter by status/priority

**Sessions**
- See all active sessions
- Monitor session status (live via RTDB)
- View session timeline
- See which task a session is working on
- Get notified when a session needs input

**Quick Actions**
- Pull-to-refresh
- Swipe to complete/block tasks
- Tap to copy task ID
- Share task via system share sheet

### Phase 2: Control (Post-MVP)

What you can do on your phone later:

- Start/stop sessions (via Cloud Functions trigger)
- View live terminal output (RTDB stream)
- Approve session input requests
- Add task comments
- Upload photos/screenshots as context docs
- Voice-to-task creation

### Phase 3: Advanced

- Offline task creation with photo attachments
- Push notifications for session events
- Widget for session status on home screen
- Shortcut actions (iOS Shortcuts, Android Quick Settings)

## Push Notifications

Firebase Cloud Messaging (FCM) for push notifications.

```typescript
// Cloud Function: notify on session completion
export const onSessionComplete = functions.firestore
  .document('sessions/{sessionId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    if (before.status !== 'completed' && after.status === 'completed') {
      const userDoc = await admin.firestore().doc(`users/${after.userId}`).get();
      const fcmToken = userDoc.data()?.fcmToken;

      if (fcmToken) {
        await admin.messaging().send({
          token: fcmToken,
          notification: {
            title: 'Session Complete',
            body: `Session "${after.name}" finished successfully.`
          },
          data: {
            sessionId: context.params.sessionId,
            type: 'session_completed'
          }
        });
      }
    }
  });
```

## Development Workflow

```bash
# Desktop development (unchanged)
cd maestro-ui
npm run dev          # Vite dev server at localhost:5173

# Mobile development
npm run build        # Build web assets
npx cap sync         # Copy to native projects
npx cap open ios     # Open Xcode
npx cap open android # Open Android Studio

# Live reload during mobile dev
npx cap run ios --livereload --external
```

## App Store Preparation

### iOS
- Apple Developer Account ($99/year)
- Xcode for building
- App Store Connect for distribution
- TestFlight for beta testing

### Android
- Google Play Console ($25 one-time)
- Android Studio for building
- Google Play for distribution
- Internal testing track for beta

### Timeline
- Week 1: Responsive CSS, mobile layout
- Week 2: Capacitor setup, build pipeline
- Week 3: Test on real devices, fix issues
- Week 4: Beta via TestFlight / Play internal track
