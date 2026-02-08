export function normalizeSmartQuotes(input: string): string {
  return input.replace(/[“”„‟«»]/g, "\"").replace(/[‘’‚‛‹›]/g, "'");
}

export function unescapeDoubleQuotedEnvValue(input: string): string {
  return input
    .replace(/\\\\/g, "\\")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, "\"");
}
