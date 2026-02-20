# Terminal, Session Logs, and Permissions

This page explains how Maestro terminal sessions work, why these controls exist, and how they help users run agent workflows safely.

## PTY terminal sessions
**What it is:** Each session runs in a real PTY-backed shell (not a fake console), with streaming output, resize support, and interactive input.

**Why it exists:** Agents often need real shell behavior (prompts, ANSI output, interactive tools, SSH, long-running commands).

**User benefit:** Commands behave the same way they do in a native terminal, so debugging and automation are reliable.

## Persistent sessions
**What it is:** Sessions can be marked persistent and restored, so context and command history survive UI transitions and reconnects.

**Why it exists:** Agent work is frequently multi-step and long-lived. Restarting from scratch wastes time and loses state.

**User benefit:** You can leave and return without losing active work, reducing reruns and setup overhead.

## Session logs and transcript viewer
**What it is:** Session input/output is captured as a timeline that can be viewed later as an execution transcript.

**Why it exists:** Teams need traceability for what was executed, what output appeared, and when decisions were made.

**User benefit:** Faster troubleshooting, easier handoffs, and an auditable record for reviews and postmortems.

## Needs-input pause and resume
**What it is:** When a flow reaches a step requiring human input, execution pauses with a “needs input” state and resumes after response.

**Why it exists:** Not every operation can be safely auto-decided (approvals, clarifications, credentials, environment choices).

**User benefit:** Keeps automation moving while preserving human checkpoints where judgment is required.

## Command permissions and capabilities
**What it is:** Command execution is governed by capability/permission controls (what actions are allowed, disallowed, or require escalation).

**Why it exists:** Agents need guardrails for sensitive operations, especially around filesystem, network, and privileged commands.

**User benefit:** Stronger safety by default while still allowing controlled access when necessary.

## Launch and access rights
**What it is:** Rights determine who can start sessions, reconnect to them, or interact with specific terminal contexts.

**Why it exists:** Multi-user environments need clear ownership and access boundaries.

**User benefit:** Prevents accidental or unauthorized session control and keeps collaboration predictable.

## How these pieces work together
PTY sessions provide real execution. Persistence preserves context. Logs provide transparency. Needs-input enables safe human checkpoints. Permissions and launch rights enforce control boundaries. Together, they deliver agent terminal workflows that are practical, auditable, and safe.
