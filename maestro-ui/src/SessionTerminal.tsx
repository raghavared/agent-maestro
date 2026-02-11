import { invoke } from "@tauri-apps/api/core";
import React, { useEffect, useRef } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import type { PendingDataBuffer } from "./app/types/app-state";

export type TerminalRegistry = Map<string, { term: Terminal; fit: FitAddon }>;

type RenderDimension = { width: number; height: number };
type RenderDimensionsFallback = {
  css: { canvas: RenderDimension; cell: RenderDimension };
  device: {
    canvas: RenderDimension;
    cell: RenderDimension;
    char: { width: number; height: number; left: number; top: number };
  };
};

function createEmptyRenderDimensions(): RenderDimensionsFallback {
  const dim = (): RenderDimension => ({ width: 0, height: 0 });
  return {
    css: { canvas: dim(), cell: dim() },
    device: { canvas: dim(), cell: dim(), char: { width: 0, height: 0, left: 0, top: 0 } },
  };
}

function patchXtermRenderServiceDimensions(term: Terminal): void {
  try {
    const core = (term as unknown as { _core?: any })._core;
    const renderService = core?._renderService;
    if (!renderService) return;
    if (renderService.__agentsUiSafeDimensions) return;

    const fallback = createEmptyRenderDimensions();
    Object.defineProperty(renderService, "dimensions", {
      configurable: true,
      enumerable: true,
      get: () => {
        const rendererRef = renderService?._renderer;
        const renderer = rendererRef?.value ?? rendererRef?._value ?? null;
        return renderer?.dimensions ?? fallback;
      },
    });

    renderService.__agentsUiSafeDimensions = true;
  } catch {
    // ignore
  }
}

function isXtermRendererReady(term: Terminal): boolean {
  const core = (term as unknown as { _core?: any })._core;
  const renderService = core?._renderService;
  const rendererRef = renderService?._renderer;
  const renderer = rendererRef?.value ?? rendererRef?._value ?? null;
  return Boolean(renderer && renderer.dimensions);
}

async function copyToClipboard(text: string): Promise<boolean> {
  const value = text ?? "";
  if (!value) return false;

  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    // fall through
  }

  try {
    const el = document.createElement("textarea");
    el.value = value;
    el.setAttribute("readonly", "true");
    el.style.position = "fixed";
    el.style.left = "-9999px";
    el.style.top = "0";
    document.body.appendChild(el);
    el.focus();
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

interface SessionTerminalProps {
  id: string;
  active: boolean;
  readOnly: boolean;
  persistent?: boolean;
  onCwdChange?: (id: string, cwd: string) => void;
  onCommandChange?: (id: string, commandLine: string, source?: "osc" | "input") => void;
  onResize?: (id: string, size: { cols: number; rows: number }) => void;
  onUserEnter?: (id: string) => void;
  registry: React.MutableRefObject<TerminalRegistry>;
  pendingData: React.MutableRefObject<PendingDataBuffer>;
}

const SessionTerminal = React.memo(function SessionTerminal(props: SessionTerminalProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const resizeRafRef = useRef<number | null>(null);
  const resizeTimeoutRef = useRef<number | null>(null);
  const resizeRetryCountRef = useRef(0);
  const lastSizeRef = useRef<{ cols: number; rows: number } | null>(null);
  const wheelRemainderRef = useRef<number>(0);
  const commandBufferRef = useRef<string>("");

  const onCwdChangeRef = useRef(props.onCwdChange);
  onCwdChangeRef.current = props.onCwdChange;
  const onCommandChangeRef = useRef(props.onCommandChange);
  onCommandChangeRef.current = props.onCommandChange;
  const onResizeRef = useRef(props.onResize);
  onResizeRef.current = props.onResize;
  const onUserEnterRef = useRef(props.onUserEnter);
  onUserEnterRef.current = props.onUserEnter;

  useEffect(() => {
    if (!containerRef.current) return;
    if (termRef.current) return;

    const container = containerRef.current;
    if (!container) return;

    const term = new Terminal({
      allowProposedApi: true,
      cursorBlink: true,
      disableStdin: props.readOnly,
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      fontSize: 13,
      theme: {
        background: "#0a0e16",
        foreground: "#f0f4f8",
        cursor: "#6b8afd",
        selectionBackground: "rgba(34,211,238,0.25)",
      },
      scrollback: 5000,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(container);
    patchXtermRenderServiceDimensions(term);

    if (props.persistent) {
      const skipEscapeSequence = (data: string, start: number): number => {
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

      const ingestUserInputForCommandDetection = (data: string) => {
        let buffer = commandBufferRef.current;
        const submitted: string[] = [];

        let i = 0;
        while (i < data.length) {
          const ch = data[i];
          if (ch === "\r") {
            if (data[i + 1] === "\n") i += 1;
            submitted.push(buffer);
            buffer = "";
            i += 1;
            continue;
          }
          if (ch === "\n") {
            submitted.push(buffer);
            buffer = "";
            i += 1;
            continue;
          }
          if (ch === "\u007f" || ch === "\b") {
            buffer = buffer.slice(0, -1);
            i += 1;
            continue;
          }
          if (ch === "\u0015") {
            buffer = "";
            i += 1;
            continue;
          }
          if (ch === "\u001b") {
            i = skipEscapeSequence(data, i + 1);
            continue;
          }
          if (ch < " " || ch === "\u007f") {
            i += 1;
            continue;
          }
          buffer += ch;
          i += 1;
        }

        commandBufferRef.current = buffer;

        for (const line of submitted) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          onCommandChangeRef.current?.(props.id, trimmed, "input");
        }
      };

      term.attachCustomKeyEventHandler((event) => {
        // Block Shift+Enter across ALL event types (keydown, keypress, keyup)
        // to prevent keypress from sending \r through onData.
        const isEnter = event.key === "Enter";
        if (event.shiftKey && isEnter && !event.metaKey && !event.ctrlKey && !event.altKey) {
          if (event.type === "keydown") {
            void invoke("write_to_session", { id: props.id, data: "\x1b[13;2u", source: "user" }).catch(() => {});
          }
          return false;
        }

        if (event.type !== "keydown") return true;
        const key = event.key;
        const isCopy =
          (event.metaKey || (event.ctrlKey && event.shiftKey)) &&
          !event.altKey &&
          key.toLowerCase() === "c";
        if (isCopy && term.hasSelection()) {
          void copyToClipboard(term.getSelection());
          return false;
        }

        return true;
      });
      term.onData((data) => {
        void invoke("write_to_session", { id: props.id, data, source: "user" }).catch(() => {});
        if (data.includes("\r") || data.includes("\n")) {
          onUserEnterRef.current?.(props.id);
        }
        ingestUserInputForCommandDetection(data);
      });
    } else {
      term.attachCustomKeyEventHandler((event) => {
        // Block Shift+Enter across ALL event types (keydown, keypress, keyup)
        // to prevent keypress from sending \r through onData.
        const isEnter = event.key === "Enter";
        if (event.shiftKey && isEnter && !event.metaKey && !event.ctrlKey && !event.altKey) {
          if (event.type === "keydown") {
            void invoke("write_to_session", { id: props.id, data: "\x1b[13;2u", source: "user" }).catch(() => {});
          }
          return false;
        }

        if (event.type !== "keydown") return true;
        const key = event.key;
        const isCopy =
          (event.metaKey || (event.ctrlKey && event.shiftKey)) &&
          !event.altKey &&
          key.toLowerCase() === "c";
        if (isCopy && term.hasSelection()) {
          void copyToClipboard(term.getSelection());
          return false;
        }

        return true;
      });
      term.onData((data) => {
        void invoke("write_to_session", { id: props.id, data, source: "user" }).catch(() => {});
        if (data.includes("\r") || data.includes("\n")) {
          onUserEnterRef.current?.(props.id);
        }
      });
    }

	    termRef.current = term;
	    fitRef.current = fit;

    const oscDisposables: Array<{ dispose: () => void }> = [];
    const reportCwd = (cwd: string) => {
      const trimmed = cwd.trim();
      if (!trimmed) return;
      onCwdChangeRef.current?.(props.id, trimmed);
    };
    const reportCommand = (commandLine: string) => {
      onCommandChangeRef.current?.(props.id, commandLine, "osc");
    };

    const parseFileUrlPath = (data: string): string | null => {
      if (!data.startsWith("file://")) return null;
      const rest = data.slice("file://".length);
      const slashIdx = rest.indexOf("/");
      if (slashIdx < 0) return null;
      const rawPath = rest.slice(slashIdx);
      try {
        return decodeURIComponent(rawPath);
      } catch {
        return rawPath;
      }
    };

	    if (term.parser) {
	      oscDisposables.push(
	        term.parser.registerOscHandler(7, (data) => {
	          const path = parseFileUrlPath(data);
	          if (path) reportCwd(path);
	          return true;
	        }),
	      );
      oscDisposables.push(
        term.parser.registerOscHandler(1337, (data) => {
          const cwdPrefix = "CurrentDir=";
          if (data.startsWith(cwdPrefix)) {
            const cwd = data.slice(cwdPrefix.length);
            reportCwd(cwd);
            return true;
          }

          const cmdPrefix = "Command=";
          if (data.startsWith(cmdPrefix)) {
            const cmd = data.slice(cmdPrefix.length);
            reportCommand(cmd);
            return true;
          }

          return false;
        }),
      );

      // Kitty keyboard protocol support – respond to mode queries from programs
      // like Claude Code so they know the terminal supports enhanced key reporting
      // (e.g. distinguishing Shift+Enter from plain Enter via CSI 13;2 u).
      const kittyModeStack: number[] = [];

      // Push mode: CSI > flags u
      oscDisposables.push(
        term.parser.registerCsiHandler({ final: "u", prefix: ">" }, (params) => {
          const flags = params.length > 0 ? (params[0] as number) : 0;
          kittyModeStack.push(flags);
          return true;
        }),
      );

      // Pop mode: CSI < count u
      oscDisposables.push(
        term.parser.registerCsiHandler({ final: "u", prefix: "<" }, (params) => {
          const count = params.length > 0 && (params[0] as number) > 0 ? (params[0] as number) : 1;
          for (let i = 0; i < count && kittyModeStack.length > 0; i++) {
            kittyModeStack.pop();
          }
          return true;
        }),
      );

      // Query: CSI ? u – respond with current flags so the program enables enhanced keys
      oscDisposables.push(
        term.parser.registerCsiHandler({ final: "u", prefix: "?" }, () => {
          const currentFlags = kittyModeStack.length > 0
            ? kittyModeStack[kittyModeStack.length - 1]
            : 0;
          void invoke("write_to_session", {
            id: props.id,
            data: `\x1b[?${currentFlags}u`,
          }).catch(() => {});
          return true;
        }),
      );

	    }

	    function scheduleResize() {
	      if (resizeRafRef.current !== null) return;
	      if (resizeTimeoutRef.current !== null) return;

	      const attempts = resizeRetryCountRef.current;
	      if (attempts < 5) {
	        resizeRafRef.current = window.requestAnimationFrame(() => {
	          resizeRafRef.current = null;
	          sendResize();
	        });
	        return;
	      }

	      const exp = Math.min(attempts - 5, 6);
	      const delay = Math.min(500, 16 * 2 ** exp);
	      resizeTimeoutRef.current = window.setTimeout(() => {
	        resizeTimeoutRef.current = null;
	        sendResize();
	      }, delay);
	    }

	    function sendResize() {
	      const term = termRef.current;
	      const fit = fitRef.current;
	      if (!term || !fit) return;
	      if (!term.element) return;
	      const rect = container.getBoundingClientRect();
	      if (rect.width === 0 || rect.height === 0) return;

	      if (!isXtermRendererReady(term)) {
	        resizeRetryCountRef.current += 1;
	        scheduleResize();
	        return;
	      }

	      try {
	        fit.fit();
	      } catch {
	        resizeRetryCountRef.current += 1;
	        scheduleResize();
	        return;
	      }

	      resizeRetryCountRef.current = 0;
	      const { cols, rows } = term;
	      const last = lastSizeRef.current;
	      if (last && last.cols === cols && last.rows === rows) return;
	      lastSizeRef.current = { cols, rows };
	      onResizeRef.current?.(props.id, { cols, rows });
	      void invoke("resize_session", { id: props.id, cols, rows }).catch(() => {});
	    }

		    // Register BEFORE flushing to avoid race with incoming events
		    props.registry.current.set(props.id, { term, fit });

	    // Flush any buffered data that arrived before we were ready (but wait for renderer readiness)
	    const flushPending = (attemptsLeft: number) => {
	      const term = termRef.current;
	      if (!term) return;
	      const buffered = props.pendingData.current.get(props.id);
	      if (!buffered || buffered.length === 0) {
	        props.pendingData.current.delete(props.id);
	        return;
	      }
	      if (!isXtermRendererReady(term)) {
	        if (attemptsLeft > 0) {
	          window.requestAnimationFrame(() => flushPending(attemptsLeft - 1));
	        }
	        return;
	      }

	      let index = 0;
	      try {
	        for (; index < buffered.length; index += 1) {
	          term.write(buffered[index]);
	        }
	        props.pendingData.current.delete(props.id);
	      } catch {
	        if (index > 0) {
	          props.pendingData.current.set(props.id, buffered.slice(index));
	        }
	        if (attemptsLeft > 0) {
	          window.requestAnimationFrame(() => flushPending(attemptsLeft - 1));
	        }
	      }
	    };
	    flushPending(20);

		    // Create ResizeObserver inside useEffect for proper cleanup
		    const resizeObserver = new ResizeObserver(() => scheduleResize());

		    resizeObserver.observe(container);
		    scheduleResize();


	    return () => {
	      resizeObserver.disconnect();
	      if (resizeRafRef.current !== null) {
	        window.cancelAnimationFrame(resizeRafRef.current);
	      }
	      if (resizeTimeoutRef.current !== null) {
	        window.clearTimeout(resizeTimeoutRef.current);
	      }
	      for (const d of oscDisposables) d.dispose();
	      props.registry.current.delete(props.id);
	      props.pendingData.current.delete(props.id);
	      term.dispose();
	      termRef.current = null;
	      fitRef.current = null;
	      resizeRafRef.current = null;
	      resizeTimeoutRef.current = null;
	      resizeRetryCountRef.current = 0;
	    };
	  }, [props.id, props.persistent, props.registry, props.pendingData]);

  useEffect(() => {
    if (!props.active) return;
    const term = termRef.current;
    const fit = fitRef.current;
    const container = containerRef.current;
    if (!term || !fit || !container) return;

    let cancelled = false;
	    const attemptFit = (attemptsLeft: number) => {
	      if (cancelled) return;
	      const rect = container.getBoundingClientRect();
	      if (rect.width === 0 || rect.height === 0) {
	        if (attemptsLeft > 0) {
	          window.requestAnimationFrame(() => attemptFit(attemptsLeft - 1));
	        }
	        return;
	      }
	      if (!isXtermRendererReady(term)) {
	        if (attemptsLeft > 0) {
	          window.requestAnimationFrame(() => attemptFit(attemptsLeft - 1));
	        }
	        return;
	      }

	      try {
	        term.focus();
	      } catch {
	        if (attemptsLeft > 0) {
	          window.requestAnimationFrame(() => attemptFit(attemptsLeft - 1));
	        }
	        return;
	      }
	      try {
	        fit.fit();
	      } catch {
	        if (attemptsLeft > 0) {
	          window.requestAnimationFrame(() => attemptFit(attemptsLeft - 1));
	        }
	        return;
	      }
	      const { cols, rows } = term;
	      const last = lastSizeRef.current;
	      if (!last || last.cols !== cols || last.rows !== rows) {
	        lastSizeRef.current = { cols, rows };
	        void invoke("resize_session", { id: props.id, cols, rows }).catch(() => {});
      }
    };

    attemptFit(8);
    return () => {
      cancelled = true;
    };
  }, [props.active, props.id]);

  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    term.options.disableStdin = props.readOnly;
  }, [props.readOnly]);

  return <div ref={containerRef} style={{ height: "100%", width: "100%" }} />;
});

export default SessionTerminal;
