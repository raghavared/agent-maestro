# Branding Update: Agents UI → Agent Maestro

## Summary
Successfully updated all user-facing references from "Agents UI" to "Agent Maestro" throughout the codebase while preserving technical identifiers for backward compatibility.

## Changes Made

### Core Application Files

#### GitHub Issue Templates
- `.github/ISSUE_TEMPLATE/question.md` - Updated about field and version label
- `.github/ISSUE_TEMPLATE/bug_report.md` - Updated about field and version label
- `.github/ISSUE_TEMPLATE/feature_request.md` - Updated about field

#### UI Configuration
- `maestro-ui/index.html` - Updated `<title>` tag
- `maestro-ui/src-tauri/tauri.conf.json` - Updated `productName` and window `title`

#### Rust Backend
- `maestro-ui/src-tauri/src/tray.rs` - Updated:
  - Tray tooltip text
  - "Open Agents UI" menu item
  - Status messages
- `maestro-ui/src-tauri/Cargo.toml` - Updated package description

#### React Components
- `maestro-ui/src/components/modals/SecureStorageModal.tsx` - Updated help text
- `maestro-ui/src/components/modals/PersistentSessionsModal.tsx` - Updated description

#### Scripts
- `scripts/purge-agents-ui-macos.sh` - Updated:
  - APP_NAME variable
  - Help text and usage documentation
  - User-facing messages
- `scripts/setup-skills.sh` - Updated console message

#### CLI
- `maestro-cli/src/commands/session.ts` - Updated "Waiting for..." message

#### Server
- `maestro-server/src/api/sessionRoutes.ts` - Updated spawn response message

#### Documentation
- `maestro-ui/README.md` - Updated:
  - Logo alt text
  - Main heading
  - All user-facing references
  - Security & Privacy section
  - FAQ section
- All `.md` files in `maestro-server/docs/`
- All `.md` files in `maestro-server/spec/`
- All `.md` files in `docs/`

## Technical Identifiers Preserved (Not Changed)

The following were intentionally **NOT** changed to maintain backward compatibility:

### Package & Bundle Identifiers
- Bundle ID: `com.agents-ui.desktop`
- Cargo package name: `agents-ui`
- NPM package name: `agents-ui-desktop`

### Storage Keys
- `agents-ui-projects`
- `agents-ui-active-project-id`
- `agents-ui-sessions-v1`
- `agents-ui-active-session-by-project-v1`
- `agents-ui-sidebar-*`
- `agents-ui-right-panel-*`
- `agents-ui-workspace-*`
- `agents-ui-theme-v1`
- `agents-ui-zoom-v1`
- `agents-ui-setup-complete-v1`
- `agents-ui-recent-sessions-v1`

### File Paths & Directories
- `/tmp/agents-ui-zellij`
- `/tmp/agents-ui-ssh`
- `agents-ui-zdotdir-*`
- `agents-ui-tmp.*`
- `agents-ui-downloads`
- `.agents-ui/` directory (e.g., `~/.agents-ui/maestro-skills/`)

### System Identifiers
- Keychain account: `agents-ui-data-key-v1`
- Tray ID: `agents-ui-tray`
- Secret contexts: `agents-ui/state/v1`, `agents-ui/recording/v1`
- Schema URLs: `https://agents-ui.maestro.dev`

### Git Repository References
- GitHub repository URL: `https://github.com/FusionbaseHQ/agents-ui`
- Release URLs and badges

## Verification

All instances of user-facing "Agents UI" text have been successfully replaced with "Agent Maestro" while maintaining technical compatibility.

```bash
# Verify no remaining "Agents UI" in user-facing text
grep -r "Agents UI" --include="*.ts" --include="*.tsx" --include="*.rs" --include="*.html" --include="*.json" .
# Returns: Only technical identifiers remain (as expected)

# Verify documentation updates
grep -r "Agents UI" docs/ maestro-server/docs/ maestro-server/spec/
# Returns: No matches (all updated)
```

## Impact

- ✅ **Users** will see "Agent Maestro" throughout the application
- ✅ **Builds** will show "Agent Maestro" as the product name
- ✅ **Issue templates** reference the new name
- ✅ **Documentation** uses consistent branding
- ✅ **Backward compatibility** maintained for:
  - Existing user data (storage keys)
  - App bundle identifier
  - Package names
  - File paths and directories

## Next Steps

To complete the rebrand (optional):
1. Consider renaming the GitHub repository
2. Update release notes and changelog
3. Update any external documentation or marketing materials
4. Consider migrating storage keys in a future major version
