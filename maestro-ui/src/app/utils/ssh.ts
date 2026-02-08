


export function shellEscapePosix(value: string): string {
  let out = "'";
  for (const ch of value) {
    if (ch === "'") out += "'\"'\"'";
    else out += ch;
  }
  out += "'";
  return out;
}



export function buildSshCommandAtRemoteDir(input: {
  baseCommandLine: string | null;
  target: string;
  remoteDir: string;
}): string {
  const target = input.target.trim();
  const remoteDir = input.remoteDir.trim();
  const base = input.baseCommandLine?.trim() ?? "";

  const parts = base && isSshCommandLine(base) ? base.split(/\s+/).filter(Boolean) : [];
  const program = parts[0] ?? "ssh";

  // Best-effort reuse of SSH options from the current session's command line.
  // IMPORTANT: Never assume the last token is the target; SSH commands may already include a remote command.
  const idxTarget = parts.findIndex((p) => p === target);
  const optionsRaw = idxTarget > 0 ? parts.slice(1, idxTarget) : [];
  const options = optionsRaw.filter(
    (tok) => tok !== "-N" && tok !== "-n" && tok !== "-f" && tok !== "-T" && tok !== "-t" && tok !== "-tt",
  );

  const script = `cd -- "$1" 2>/dev/null || echo "cd failed: $1" >&2; exec "\${SHELL:-sh}"`;
  const remoteCommand = `sh -lc ${shellEscapePosix(script)} -- ${shellEscapePosix(remoteDir)}`;
  // IMPORTANT: pass the remote command as a *single* ssh argument so remote quoting survives.
  const remoteCommandArg = shellEscapePosix(remoteCommand);

  return [program, ...options, "-t", target, remoteCommandArg].join(" ");
}

export function isSshCommandLine(commandLine: string | null | undefined): boolean {
  const trimmed = commandLine?.trim() ?? "";
  if (!trimmed) return false;
  const token = trimmed.split(/\s+/)[0];
  const base = token.split(/[\\/]/).pop() ?? token;
  return base.toLowerCase().replace(/\.exe$/, "") === "ssh";
}

export function sshTargetFromCommandLine(commandLine: string | null | undefined): string | null {
  const trimmed = commandLine?.trim() ?? "";
  if (!trimmed) return null;
  if (!isSshCommandLine(trimmed)) return null;
  const parts = trimmed.split(/\s+/);
  const target = parts[parts.length - 1]?.trim() ?? "";
  return target ? target : null;
}
export function parsePort(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const num = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(num) || num < 1 || num > 65535) return null;
  return num;
}

export function sshForwardFlag(type: SshForwardType): "-L" | "-R" | "-D" {
  if (type === "remote") return "-R";
  if (type === "dynamic") return "-D";
  return "-L";
}

export function sshForwardSpec(f: SshForward): string | null {
  const listenPort = parsePort(f.listenPort);
  if (!listenPort) return null;

  const bind = f.bindAddress.trim();
  if (f.type === "dynamic") {
    return bind ? `${bind}:${listenPort}` : `${listenPort}`;
  }

  const destHost = f.destinationHost.trim();
  const destPort = parsePort(f.destinationPort);
  if (!destHost || !destPort) return null;

  const prefix = bind ? `${bind}:${listenPort}` : `${listenPort}`;
  return `${prefix}:${destHost}:${destPort}`;
}

export function buildSshCommand(input: {
  host: string;
  forwards: SshForward[];
  exitOnForwardFailure: boolean;
  forwardOnly: boolean;
}): string | null {
  const host = input.host.trim();
  if (!host) return null;

  const args: string[] = ["ssh"];
  if (input.exitOnForwardFailure && input.forwards.length > 0) {
    args.push("-o", "ExitOnForwardFailure=yes");
  }
  if (input.forwardOnly) {
    args.push("-N");
  }
  for (const f of input.forwards) {
    const spec = sshForwardSpec(f);
    if (!spec) return null;
    args.push(sshForwardFlag(f.type), spec);
  }
  args.push(host);

  return args.join(" ");
}


export type SshHostEntry = {
  alias: string;
  hostName?: string | null;
  user?: string | null;
  port?: number | null;
};

export type SshForwardType = "local" | "remote" | "dynamic";

export type SshForward = {
  id: string;
  type: SshForwardType;
  bindAddress: string;
  listenPort: string;
  destinationHost: string;
  destinationPort: string;
};

