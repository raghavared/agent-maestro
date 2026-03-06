# PTY/Terminal Memory Management Analysis

## Overview

Analysis of `maestro-ui/src-tauri/src/pty.rs` for resource lifecycle correctness and scalability under many simultaneous terminals.

---

## 1. Thread Lifecycle (create_session L858)

Each `create_session()` spawns a **dedicated OS thread** (L858: `std::thread::spawn`) that runs a blocking read loop on the PTY master reader.

**When does it terminate?**
- The thread exits when `reader.read()` returns `Ok(0)` (EOF) or `Err(_)` (L862-877).
- EOF occurs when the child process exits and the slave side of the PTY is closed.
- After the read loop exits, the thread **removes the session from the HashMap** (L893-894) and calls `child.wait()` (L899) before emitting `pty-exit`.

**Verdict:** Thread lifecycle is correct — it naturally terminates when the child dies. However, there is **no timeout** — if a child hangs without closing its PTY slave FD (e.g., orphaned grandchild processes), the thread blocks indefinitely.

---

## 2. close_session() Race Condition (L1088)

`close_session()` does:
1. Sets `session.closing = true`
2. Calls `session.child.kill()`

The `PtySession` struct (containing `master`, `writer`, `child`) remains in the `sessions` HashMap. It is only removed by the reader thread (L893-894) when it detects EOF after the child dies.

**Potential race window:**
- Between `child.kill()` and the reader thread detecting EOF and removing the session, the session is in a "zombie" state: `closing=true`, still in the map.
- During this window, `write_to_session` and `resize_session` both check `session.closing` and no-op, so no functional issue.
- `close_session` itself is idempotent (checks `closing` flag first).
- The Mutex is held only briefly in each call, so no deadlock.

**Verdict:** No race condition bug. The two-phase cleanup (mark closing → reader thread removes) is safe because all mutation paths check the `closing` flag. The only concern is the **window where resources are still allocated** (master FD, writer, child struct) between kill and EOF detection — typically milliseconds, but could be longer if the child doesn't die immediately from SIGKILL.

---

## 3. Scrollback Buffer (SessionTerminal.tsx:124)

```ts
scrollback: 5000,
```

Each xterm.js Terminal with `scrollback: 5000` keeps up to 5000 lines in memory. At ~200 bytes/line average, that's ~1MB per terminal.

**With 50 terminals:** ~50MB of scrollback memory in the renderer process.

**Verdict:** 5000 is a reasonable default. For 50+ terminals this is manageable but not negligible. xterm.js stores lines as typed arrays, so actual memory is lower than naive estimates. This is unlikely to be the primary bottleneck.

---

## 4. ZDOTDIR Temp Directory Cleanup (L803)

```rust
let dotdir = Some(std::env::temp_dir().join(format!("agents-ui-zdotdir-{id}")));
```

Creates a temp directory at `/tmp/agents-ui-zdotdir-{id}` containing 4 zsh startup files (.zshenv, .zprofile, .zlogin, .zshrc).

**Is it cleaned up?** **NO.** There is no code anywhere in the codebase that removes these directories. They accumulate with each new zsh shell session.

**Impact:** Each directory is ~4 small files (< 4KB total). Over hundreds of sessions they'll accumulate in `/tmp/`. The OS typically clears `/tmp` on reboot (macOS clears periodically), so this is a **minor leak** — not a memory issue, but untidy.

**Recommendation:** Add cleanup in the reader thread's cleanup phase (after removing from HashMap) or in `close_session()`.

---

## 5. PTY File Descriptor Lifecycle

When `session.closing = true` but child hasn't exited:

- The `master` PTY fd and `writer` fd remain **open** and held by the `PtySession` struct in the HashMap.
- The reader thread holds a **cloned reader** of the master fd (obtained via `try_clone_reader()` at L821-824).
- The thread keeps this FD open until EOF is detected.

After the reader thread removes the session from the HashMap (L893-894), the `PtySession` is dropped:
- `master` (Box<dyn MasterPty>) — dropped, closing the master FD via `portable_pty`'s Drop impl
- `writer` — dropped, closing the writer FD
- `child` — dropped after `wait()` is called (L899)

**Verdict:** FDs are properly closed through Rust's Drop semantics when the `PtySession` is removed from the HashMap. The reader's cloned FD is also dropped when the thread exits. `portable_pty 0.8.1` uses `OwnedFd`/`close()` in its Drop impls. **No FD leak.**

---

## 6. Session Count Limits

**There is no limit** on how many simultaneous PTY sessions can be created. The only constraints are:

- **OS PTY limit:** macOS default is 127 PTYs (`sysctl kern.tty.ptmx_max`). Linux default varies but is typically 4096 (`/proc/sys/kernel/pty.max`).
- **Thread limit:** Each session spawns an OS thread. Default stack size is 8MB on macOS, so 50 sessions = ~400MB of virtual (not resident) memory for thread stacks alone.
- **FD limit:** Each session uses at least 2 FDs (master + cloned reader). Default `ulimit -n` is often 256 on macOS. With 50+ sessions, other FDs (files, sockets), you could hit the limit.

**Verdict:** **Missing safeguard.** There should be a configurable maximum session count to prevent resource exhaustion. Hitting the macOS PTY or FD limit will cause cryptic errors.

---

## 7. Master PTY FD Closure

The master PTY FD is **not explicitly closed** — it relies on Rust's Drop semantics:

1. `pair.master` is moved into `PtySession` (L847)
2. A reader is cloned from it via `try_clone_reader()` (L821-824)
3. A writer is taken via `take_writer()` (L826-829)
4. When the reader thread removes the PtySession from the HashMap (L893-894), all three are dropped

`portable_pty` 0.8.1's `UnixMasterPty` wraps the fd in an `OwnedFd`, which calls `close()` on drop. This is correct.

**Verdict:** Implicit closure via Drop is idiomatic Rust and correct. No explicit close needed.

---

## Summary: What happens with 50+ terminals?

| Resource | Per Session | 50 Sessions | Risk |
|----------|------------|-------------|------|
| OS Thread | 1 (8MB virt stack) | 50 threads (~400MB virt) | Medium — high virtual memory |
| PTY FDs | 2-3 | 100-150 FDs | **High** — may hit ulimit |
| OS PTY slots | 1 | 50 of ~127 (macOS) | **High** — close to limit |
| Scrollback (JS) | ~1MB | ~50MB | Low |
| ZDOTDIR temp dirs | ~4KB | ~200KB (never cleaned) | Low (cosmetic) |
| Reader thread | blocks on read | 50 blocked threads | Medium |

### Key Findings

1. **Thread lifecycle is correct** — threads terminate naturally when child exits.
2. **No race condition** in close_session — the two-phase cleanup is safe.
3. **No FD leaks** — Drop semantics handle cleanup properly.
4. **ZDOTDIR temp dirs are never cleaned up** — minor leak.
5. **No session count limit** — the main scalability risk. Could hit OS PTY or FD limits.
6. **No timeout on thread blocking** — if a child's grandchild holds the PTY slave open, the thread (and its resources) leak indefinitely.
7. **Scrollback is reasonable** at 5000 lines.

### Recommendations (Priority Order)

1. **Add a max session limit** (e.g., 100) with a clear error message when exceeded.
2. **Clean up ZDOTDIR temp directories** when sessions close.
3. **Add a watchdog timeout** in the reader thread — if no data for N minutes after `closing=true`, force-drop the session.
