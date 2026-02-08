import { EnvironmentConfig } from "../types/app";
import { MaestroProject } from "../types/maestro";
import { normalizeSmartQuotes, unescapeDoubleQuotedEnvValue } from "./string";

export function isValidEnvKey(key: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(key.trim());
}

export function parseEnvContentToVars(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  const normalized = normalizeSmartQuotes(content);
  for (const rawLine of normalized.split(/\r?\n/)) {
    let line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith("#")) continue;
    if (line.startsWith("export ")) line = line.slice("export ".length).trim();

    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!isValidEnvKey(key)) continue;

    let value = line.slice(eq + 1).trim();
    if (!value) {
      out[key] = "";
      continue;
    }

    const first = value[0];
    const last = value[value.length - 1];
    const isDouble = first === '"' && last === '"';
    const isSingle = first === "'" && last === "'";
    if (isDouble || isSingle) {
      value = value.slice(1, -1);
      if (isDouble) value = unescapeDoubleQuotedEnvValue(value);
      out[key] = value;
      continue;
    }

    // Strip trailing comments for unquoted values when preceded by whitespace.
    for (let i = 0; i < value.length; i++) {
      if (value[i] !== "#") continue;
      if (i === 0 || /\s/.test(value[i - 1])) {
        value = value.slice(0, i).trimEnd();
        break;
      }
    }
    out[key] = value;
  }
  return out;
}

export function envVarsForProjectId(
  projectId: string,
  projects: MaestroProject[],
  environments: EnvironmentConfig[],
): Record<string, string> | null {
  const project = projects.find((p) => p.id === projectId) ?? null;
  const envId = project?.environmentId ?? null;
  if (!envId) return null;
  const env = environments.find((e) => e.id === envId) ?? null;
  if (!env) return null;
  const vars = parseEnvContentToVars(env.content);
  return Object.keys(vars).length ? vars : null;
}

export function defaultProjectState(): { projects: MaestroProject[]; activeProjectId: string } {
  return {
    projects: [],
    activeProjectId: '',
  };
}