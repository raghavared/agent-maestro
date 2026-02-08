import { invoke } from "@tauri-apps/api/core";
import { TerminalSession, TerminalSessionInfo } from "../app/types/session";
import { commandTagFromCommandLine, detectProcessEffect } from
  "../processEffects";
import { isSshCommandLine, sshTargetFromCommandLine } from "../app/utils/ssh";
import { makeId } from "../app/utils/id"; // Use the existing utility instead of



export const coercePtyDataToString = (data: unknown): string | null => {
    if (typeof data === "string") return data;
    if (!data) return null;
    try {
      if (data instanceof Uint8Array) {
        return new TextDecoder().decode(data);
      }
      if (data instanceof ArrayBuffer) {
        return new TextDecoder().decode(new Uint8Array(data));
      }
      if (Array.isArray(data) && data.every((x) => typeof x === "number")) {
        return new TextDecoder().decode(new Uint8Array(data as number[]));
      }
    } catch {
      return null;
    }
    return null;
  };

  export const skipEscapeSequence = (data: string, start: number): number => {
    const next = data[start];
    if (!next) return start;
    if (next === "[") {
      let i = start + 1;
      while (i < data.length) {
        const ch = data[i];
        if (ch >= "@" && ch <= "~") return i + 1;
        i += 1;
      }
      return i;
    }
    if (next === "]") {
      let i = start + 1;
      while (i < data.length) {
        const ch = data[i];
        if (ch === "\u0007") return i + 1;
        if (ch === "\u001b" && data[i + 1] === "\\") return i + 2;
        i += 1;
      }
      return i;
    }
    if (next === "P" || next === "^" || next === "_") {
      let i = start + 1;
      while (i < data.length) {
        if (data[i] === "\u001b" && data[i + 1] === "\\") return i + 2;
        i += 1;
      }
      return i;
    }
    return start + 1;
  };

  export const hasMeaningfulOutput = (data: string): boolean => {
    let visibleNonWhitespace = 0;
    let hasAlphaNum = false;

    let i = 0;
    while (i < data.length) {
      const ch = data[i];
      if (ch === "\u001b") {
        i = skipEscapeSequence(data, i + 1);
        continue;
      }
      if (ch < " " || ch === "\u007f") {
        i += 1;
        continue;
      }
      if (ch.trim() === "") {
        i += 1;
        continue;
      }

      visibleNonWhitespace += 1;
      if (visibleNonWhitespace >= 2) return true;
      if (/[0-9A-Za-z]/.test(ch)) hasAlphaNum = true;

      i += 1;
    }
    return hasAlphaNum;
  };
