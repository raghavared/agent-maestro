function basenamePath(input: string): string {
  const normalized = input.trim().replace(/[\\/]+$/, "");
  if (!normalized) return "";
  if (normalized === "/") return "/";
  const parts = normalized.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] ?? "";
}
