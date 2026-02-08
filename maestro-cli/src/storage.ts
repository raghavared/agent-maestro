/**
 * LocalStorage — reads ~/.maestro/data/ (written by server).
 * This is a READ-ONLY cache. All writes go through the server API.
 */

import { readFileSync, mkdirSync, readdirSync, existsSync, statSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { StoredProject, StoredTask, StoredSession } from './types/storage.js';

const DATA_DIR = process.env.DATA_DIR
  ? (process.env.DATA_DIR.startsWith('~') ? join(homedir(), process.env.DATA_DIR.slice(1)) : process.env.DATA_DIR)
  : join(homedir(), '.maestro', 'data');

export class LocalStorage {
  private projects = new Map<string, StoredProject>();
  private tasks = new Map<string, StoredTask>();
  private sessions = new Map<string, StoredSession>();
  private initialized = false;

  // ── Initialization ──────────────────────────────────────────

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.loadFromDisk();
    this.initialized = true;
  }

  private loadFromDisk(): void {
    this.ensureDirectories();

    // Load projects
    const projectsDir = join(DATA_DIR, 'projects');
    if (existsSync(projectsDir)) {
      for (const file of readdirSync(projectsDir)) {
        if (!file.endsWith('.json')) continue;
        try {
          const data = JSON.parse(readFileSync(join(projectsDir, file), 'utf-8'));
          this.projects.set(data.id, data);
        } catch { /* skip corrupt files */ }
      }
    }

    // Load tasks (nested under projectId directories)
    const tasksDir = join(DATA_DIR, 'tasks');
    if (existsSync(tasksDir)) {
      for (const projectDir of readdirSync(tasksDir)) {
        const projectTasksDir = join(tasksDir, projectDir);
        try {
          if (!statSync(projectTasksDir).isDirectory()) continue;
        } catch { continue; }

        for (const file of readdirSync(projectTasksDir)) {
          if (!file.endsWith('.json')) continue;
          try {
            const data = JSON.parse(readFileSync(join(projectTasksDir, file), 'utf-8'));
            this.tasks.set(data.id, data);
          } catch { /* skip corrupt files */ }
        }
      }
    }

    // Load sessions
    const sessionsDir = join(DATA_DIR, 'sessions');
    if (existsSync(sessionsDir)) {
      for (const file of readdirSync(sessionsDir)) {
        if (!file.endsWith('.json')) continue;
        try {
          const data = JSON.parse(readFileSync(join(sessionsDir, file), 'utf-8'));
          this.sessions.set(data.id, data);
        } catch { /* skip corrupt files */ }
      }
    }
  }

  private ensureDirectories(): void {
    mkdirSync(join(DATA_DIR, 'projects'), { recursive: true });
    mkdirSync(join(DATA_DIR, 'tasks'), { recursive: true });
    mkdirSync(join(DATA_DIR, 'sessions'), { recursive: true });
  }

  /**
   * Reload data from disk (useful after server writes)
   */
  reload(): void {
    this.projects.clear();
    this.tasks.clear();
    this.sessions.clear();
    this.initialized = false;
    this.loadFromDisk();
    this.initialized = true;
  }

  // ── Projects (READ ONLY) ──────────────────────────────────

  getProject(id: string): StoredProject | undefined {
    return this.projects.get(id);
  }

  getProjects(): StoredProject[] {
    return Array.from(this.projects.values());
  }

  // ── Tasks (READ ONLY) ─────────────────────────────────────

  getTask(id: string): StoredTask | undefined {
    return this.tasks.get(id);
  }

  getTasksByProject(projectId: string): StoredTask[] {
    return Array.from(this.tasks.values()).filter(t => t.projectId === projectId);
  }

  getTaskChildren(parentId: string): StoredTask[] {
    return Array.from(this.tasks.values()).filter(t => t.parentId === parentId);
  }

  // ── Sessions (READ ONLY) ──────────────────────────────────

  getSession(id: string): StoredSession | undefined {
    return this.sessions.get(id);
  }

  getSessionsByProject(projectId: string): StoredSession[] {
    return Array.from(this.sessions.values()).filter(s => s.projectId === projectId);
  }
}

export const storage = new LocalStorage();
