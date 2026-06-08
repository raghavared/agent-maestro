import { config } from '../config.js';

export interface ProjectScope {
  projectId?: string;
  source: 'flag' | 'global' | 'env' | 'config' | 'all-projects';
}

export function resolveProjectScope(
  cmdOpts: { projectId?: string; allProjects?: boolean },
  globalOpts: { project?: string },
): ProjectScope {
  if (cmdOpts.allProjects) return { source: 'all-projects' };
  if (cmdOpts.projectId) return { projectId: cmdOpts.projectId, source: 'flag' };
  if (globalOpts.project) return { projectId: globalOpts.project, source: 'global' };
  if (process.env.MAESTRO_PROJECT_ID) return { projectId: process.env.MAESTRO_PROJECT_ID, source: 'env' };
  if (config.projectId) return { projectId: config.projectId, source: 'config' };
  return { source: 'all-projects' };
}
