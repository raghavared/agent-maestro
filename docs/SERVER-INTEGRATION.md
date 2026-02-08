# ⚠️ DEPRECATED - SERVER-INTEGRATION.md

**This document describes an older architecture approach and is kept for historical reference only.**

**For the current server implementation, see:**
- [README.md](./README.md) - Complete implementation guide with current server code
- [FINAL-ARCHITECTURE.md](./FINAL-ARCHITECTURE.md) - Architecture overview

---

## What Changed

This document originally described server-side spawn preparation where the server built all environment variables and prepared complete spawn data, but the CLI still generated manifests at runtime.

**This has been superseded by the current architecture:**
- Server now calls `maestro manifest generate` CLI command
- Manifest is pre-generated before spawn
- Only 3 environment variables passed: MAESTRO_SESSION_ID, MAESTRO_MANIFEST_PATH, MAESTRO_SERVER_URL
- All task/project data is in the manifest file

See [README.md](./README.md) Section "1. Server Implementation" for the current server code.

---

**Date Created**: February 2026
**Superseded By**: README.md
**Status**: Deprecated - Historical Reference Only
