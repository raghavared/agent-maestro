# OpenClaw ↔ Maestro Integration

## Overview

Thin, zero-overhead integration enabling maestro agents to send notifications via OpenClaw's messaging channels (Telegram, WhatsApp, Discord, etc.).

**Architecture:** Maestro → OpenClaw (one-way). OpenClaw is used purely as a messaging delivery layer. No LLM processing, no reply routing.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Direction | Maestro → OpenClaw only | Agents send notifications; OpenClaw just delivers |
| Integration surface | SKILL.md only | Zero core changes to either system |
| Channels | Telegram, WhatsApp, Discord | User-selected priority channels |
| Message types | Custom + task completion details | Ad-hoc messages and structured task events |
| OpenClaw role | Channel delivery only | No LLM/Pi Agent involvement |

## How It Works

```
Maestro Agent
     │
     │  uses skill: maestro-notify
     │
     ▼
openclaw message send \
  --channel telegram \
  --target @username \
  --message "✅ Task done: ..."
     │
     ▼
OpenClaw Gateway (ws://127.0.0.1:18789)
     │
     ▼
Telegram / WhatsApp / Discord
```

## Produced Artifacts

### `~/.claude/skills/maestro-notify/SKILL.md`

The core integration artifact. Registered as the `maestro-notify` skill. Teaches any maestro agent how to:

- Check if OpenClaw is running (`openclaw health`)
- Send messages to Telegram, WhatsApp, Discord, Slack, and other channels
- Format task completion notifications using maestro env vars
- Send multi-channel broadcasts
- Handle troubleshooting

### Usage in Maestro Sessions

When running inside a maestro session, these env vars are available automatically:

```bash
$MAESTRO_SESSION_ID    # current session
$MAESTRO_TASK_IDS      # comma-separated task IDs
$MAESTRO_PROJECT_ID    # project ID
$MAESTRO_ROLE          # worker | coordinator
```

**Example — notify on task completion:**
```bash
openclaw message send \
  --channel telegram \
  --target @myusername \
  --message "✅ Task complete: My Task Title
Session: $MAESTRO_SESSION_ID
Tasks: $MAESTRO_TASK_IDS"
```

**Example — Discord notification:**
```bash
openclaw message send \
  --channel discord \
  --target channel:1234567890 \
  --message "⏳ Progress: $TASK_TITLE — $PROGRESS_MESSAGE"
```

## Prerequisites

OpenClaw must be installed and running:

```bash
# Install (see https://docs.openclaw.ai/install)
# Then start the gateway:
openclaw gateway &
openclaw health
```

Configure Discord:
```bash
openclaw channels login --verbose
# follow prompts to add Discord bot
```

## Zero Changes to Maestro Core

This integration requires **no changes** to:
- `maestro-server` — no new routes or handlers
- `maestro-cli` — no new commands
- `maestro-ui` — no UI changes

The `maestro-notify` SKILL.md is the complete integration.
