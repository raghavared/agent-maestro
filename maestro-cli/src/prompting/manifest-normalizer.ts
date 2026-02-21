import type { AgentMode, AgentModeInput, MaestroManifest, TeamMemberProfile } from '../types/manifest.js';
import { normalizeMode } from '../types/manifest.js';

export interface NormalizedManifestResult {
  manifest: MaestroManifest;
  warnings: string[];
  legacyModeNormalized: boolean;
  deprecatedWorkflowFieldsPresent: boolean;
}

const warnedMessages = new Set<string>();

function cloneManifest(manifest: MaestroManifest): MaestroManifest {
  return JSON.parse(JSON.stringify(manifest)) as MaestroManifest;
}

function toCanonicalMode(mode: string | undefined, hasCoordinator: boolean): AgentMode {
  const input = (mode || 'worker') as AgentModeInput;
  return normalizeMode(input, hasCoordinator);
}

function hasDeprecatedWorkflowFields(manifest: MaestroManifest): boolean {
  if (manifest.teamMemberWorkflowTemplateId || manifest.teamMemberCustomWorkflow) {
    return true;
  }

  const profiles = manifest.teamMemberProfiles || [];
  return profiles.some((profile) => Boolean(profile.workflowTemplateId || profile.customWorkflow));
}

function buildSingleProfileFromLegacyFields(manifest: MaestroManifest): TeamMemberProfile | null {
  if (!manifest.teamMemberId || !manifest.teamMemberName || !manifest.teamMemberAvatar) {
    return null;
  }

  if (manifest.teamMemberIdentity === undefined || manifest.teamMemberIdentity === null) {
    return null;
  }

  return {
    id: manifest.teamMemberId,
    name: manifest.teamMemberName,
    role: manifest.teamMemberRole,
    avatar: manifest.teamMemberAvatar,
    identity: manifest.teamMemberIdentity,
    capabilities: manifest.teamMemberCapabilities,
    commandPermissions: manifest.teamMemberCommandPermissions,
    memory: manifest.teamMemberMemory,
  };
}

export function normalizeManifest(manifest: MaestroManifest): NormalizedManifestResult {
  const normalized = cloneManifest(manifest);
  const warnings: string[] = [];

  const hasCoordinator = Boolean(normalized.coordinatorSessionId);
  const originalMode = String((manifest as any).mode || 'worker');
  const canonicalMode = toCanonicalMode(originalMode, hasCoordinator);

  let legacyModeNormalized = false;
  if (originalMode !== canonicalMode) {
    legacyModeNormalized = true;
    warnings.push(
      `Normalized legacy mode "${originalMode}" to canonical mode "${canonicalMode}".`
    );
  }
  normalized.mode = canonicalMode;

  if (normalized.teamMembers && normalized.teamMembers.length > 0) {
    normalized.teamMembers = normalized.teamMembers.map((member) => {
      if (!member.mode) {
        return member;
      }

      const originalMemberMode = String(member.mode);
      const canonicalMemberMode = toCanonicalMode(originalMemberMode, false);
      return {
        ...member,
        mode: canonicalMemberMode,
      };
    });
  }

  if (!normalized.teamMemberProfiles || normalized.teamMemberProfiles.length === 0) {
    const singleProfile = buildSingleProfileFromLegacyFields(normalized);
    if (singleProfile) {
      normalized.teamMemberProfiles = [singleProfile];
    }
  }

  const deprecatedWorkflowFieldsPresent = hasDeprecatedWorkflowFields(normalized);
  if (deprecatedWorkflowFieldsPresent) {
    warnings.push(
      'Deprecated workflow fields detected (teamMemberWorkflowTemplateId/customWorkflow). They are ignored by prompt composition.'
    );
  }

  return {
    manifest: normalized,
    warnings,
    legacyModeNormalized,
    deprecatedWorkflowFieldsPresent,
  };
}

export function logManifestNormalizationWarnings(result: NormalizedManifestResult): void {
  for (const warning of result.warnings) {
    if (warnedMessages.has(warning)) {
      continue;
    }

    warnedMessages.add(warning);
    console.warn(`[manifest-normalizer] ${warning}`);
  }
}
