# Project-Level Sound Instrument Feature

## Overview
This feature allows each project to use a different instrument for notification sounds. Previously, all projects used piano sounds. Now users can select from multiple instruments per project.

## Implementation Details

### 1. Type Changes
**File**: `maestro-ui/src/app/types/maestro.ts`
- Added `soundInstrument?: string` to `MaestroProject` interface
- Added `soundSettings?: { enabledCategories?: string[] }` for future per-project category toggles

### 2. Sound Manager Updates
**File**: `maestro-ui/src/services/soundManager.ts`
- Added `InstrumentType` type with options: 'piano', 'guitar', 'strings', 'bells', 'marimba'
- Added `currentInstrument` to `SoundManagerConfig`
- Updated `getAudioElement()` to use current instrument with fallback to piano
- Added `setInstrument()` and `getInstrument()` methods
- Instrument switching clears audio cache to force reload

### 3. Project Store Updates
**File**: `maestro-ui/src/stores/useProjectStore.ts`
- Added `projectSoundInstrument` state field
- Added `setProjectSoundInstrument()` setter
- Updated `openNewProject()` to initialize with 'piano'
- Updated `openProjectSettings()` to load project's instrument
- Updated `onProjectSubmit()` to save instrument setting

### 4. Project Settings UI
**File**: `maestro-ui/src/components/modals/ProjectModal.tsx`
- Added instrument selector dropdown with 5 options
- Added `soundInstrument` and `onChangeSoundInstrument` props
- UI hint: "Instrument used for notification sounds in this project."

**File**: `maestro-ui/src/components/app/AppModals.tsx`
- Connected ProjectModal to project store sound instrument state

### 5. Project-Sound Synchronization
**File**: `maestro-ui/src/hooks/useProjectSoundSync.ts`
- New hook that syncs sound manager instrument when active project changes
- Integrated into App.tsx to run on mount

### 6. Persistence
**File**: `maestro-ui/src/stores/persistence.ts`
- Added `soundInstrument` to persisted project data

**File**: `maestro-ui/src/stores/initApp.ts`
- Added `soundInstrument` to project loading/restoration
- Added `soundInstrument` to project sync with server
- Defaults to 'piano' if not set

## Available Instruments
1. **Piano** (default) - Uses existing `/music/piano-mp3/` files
2. **Guitar** - Falls back to piano (sound files not yet added)
3. **Strings** - Falls back to piano (sound files not yet added)
4. **Bells** - Falls back to piano (sound files not yet added)
5. **Marimba** - Falls back to piano (sound files not yet added)

## Fallback Behavior
- If instrument sound files don't exist, automatically falls back to piano
- Error is logged to console but doesn't break functionality
- This allows adding new instruments incrementally

## User Experience
1. User opens project settings (gear icon on project tab)
2. Sees "Notification Sounds" dropdown
3. Selects desired instrument
4. Saves settings
5. All notification sounds for that project now use the selected instrument
6. Switching between projects automatically switches instruments

## Future Enhancements
- Add actual sound files for non-piano instruments
- Implement per-project sound category toggles (using `soundSettings.enabledCategories`)
- Add preview button in project settings to test sounds
- Add more instrument types
- Allow users to upload custom instrument sound packs

## Testing
1. Create a new project → Should default to piano
2. Open project settings → Should show piano selected
3. Change to different instrument → Should save successfully
4. Switch between projects → Instrument should change (check console logs)
5. Create notification event → Should use project's instrument (with piano fallback)
6. Restart app → Instrument selection should persist

## Files Modified
1. `maestro-ui/src/app/types/maestro.ts`
2. `maestro-ui/src/services/soundManager.ts`
3. `maestro-ui/src/stores/useProjectStore.ts`
4. `maestro-ui/src/components/modals/ProjectModal.tsx`
5. `maestro-ui/src/components/app/AppModals.tsx`
6. `maestro-ui/src/stores/persistence.ts`
7. `maestro-ui/src/stores/initApp.ts`
8. `maestro-ui/src/App.tsx`

## Files Created
1. `maestro-ui/src/hooks/useProjectSoundSync.ts`
