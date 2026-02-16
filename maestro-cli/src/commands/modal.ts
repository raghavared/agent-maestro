import { Command } from 'commander';
import { api } from '../api.js';
import { config } from '../config.js';
import { outputJSON, outputKeyValue } from '../utils/formatter.js';
import { handleError } from '../utils/errors.js';
import { guardCommand } from '../services/command-permissions.js';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';
import ora from 'ora';
import os from 'os';
import WebSocket from 'ws';

/**
 * Get the modals directory path (inside the session directory).
 */
function getModalsDir(): string {
    const sessionDir = process.env.SESSION_DIR
        ? (process.env.SESSION_DIR.startsWith('~') ? join(os.homedir(), process.env.SESSION_DIR.slice(1)) : process.env.SESSION_DIR)
        : join(os.homedir(), '.maestro', 'sessions');
    return join(sessionDir, 'modals');
}

/**
 * Inject the Maestro bridge script into HTML content.
 * This provides `window.maestro.sendAction(action, data)` inside the modal iframe.
 * Uses both postMessage (for the parent React component) and a direct fetch
 * to the server API as a reliable fallback for webview environments where
 * postMessage or inline scripts may be restricted by CSP.
 */
function injectBridgeScript(html: string, modalId: string, sessionId?: string, apiUrl?: string): string {
    const bridgeScript = `
<script>
(function() {
  var _modalId = "${modalId}";
  var _sessionId = "${sessionId || ''}";
  var _apiUrl = "${apiUrl || ''}";

  function _postToParent(type, payload) {
    try {
      window.parent.postMessage(payload, "*");
    } catch(e) {}
  }

  function _fetchToServer(action, data) {
    if (!_sessionId || !_apiUrl) return;
    try {
      fetch(_apiUrl + "/api/sessions/" + _sessionId + "/modal/" + _modalId + "/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: action, data: data || {} })
      }).catch(function(){});
    } catch(e) {}
  }

  function _fetchCloseToServer() {
    if (!_sessionId || !_apiUrl) return;
    try {
      fetch(_apiUrl + "/api/sessions/" + _sessionId + "/modal/" + _modalId + "/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      }).catch(function(){});
    } catch(e) {}
  }

  window.maestro = {
    modalId: _modalId,
    sendAction: function(action, data) {
      _postToParent("maestro:modal_action", {
        type: "maestro:modal_action",
        modalId: _modalId,
        action: action,
        data: data || {}
      });
      _fetchToServer(action, data);
    },
    close: function() {
      _postToParent("maestro:modal_close", {
        type: "maestro:modal_close",
        modalId: _modalId
      });
      _fetchCloseToServer();
    }
  };
})();
</script>`;

    // Inject before </head> if present, otherwise prepend
    if (html.includes('</head>')) {
        return html.replace('</head>', bridgeScript + '\n</head>');
    } else if (html.includes('<body')) {
        return html.replace('<body', bridgeScript + '\n<body');
    } else {
        return bridgeScript + '\n' + html;
    }
}

export function registerModalCommands(program: Command) {
    const show = program.command('show').description('Display content in the UI');

    show.command('modal <filePath>')
        .description('Show an HTML modal in the Maestro UI')
        .option('--title <title>', 'Modal title', 'Agent Modal')
        .option('--id <modalId>', 'Custom modal ID (auto-generated if not provided)')
        .option('--interactive', 'Keep process alive and stream user actions from the modal as JSONL')
        .option('--timeout <ms>', 'Auto-exit interactive mode after N milliseconds (0 = no timeout)', '0')
        .action(async (filePath: string, cmdOpts: any) => {
            await guardCommand('show:modal');
            const globalOpts = program.opts();
            const isJson = globalOpts.json;
            const sessionId = config.sessionId;

            if (!sessionId) {
                const msg = 'No session context found (MAESTRO_SESSION_ID not set).';
                if (isJson) { console.log(JSON.stringify({ success: false, error: msg })); }
                else { console.error(msg); }
                process.exit(1);
            }

            // Read the HTML file
            let htmlContent: string;
            try {
                htmlContent = readFileSync(filePath, 'utf-8');
            } catch (e: any) {
                const msg = `Failed to read file: ${e.message}`;
                if (isJson) { console.log(JSON.stringify({ success: false, error: msg })); }
                else { console.error(msg); }
                process.exit(1);
            }

            const modalId = cmdOpts.id || `modal_${Date.now()}_${randomBytes(4).toString('hex')}`;

            // Inject the bridge script so the modal can call maestro.sendAction()
            htmlContent = injectBridgeScript(htmlContent, modalId, sessionId, config.apiUrl);

            // Save modal to local modals directory
            const modalsDir = getModalsDir();
            if (!existsSync(modalsDir)) {
                mkdirSync(modalsDir, { recursive: true });
            }
            const modalFilePath = join(modalsDir, `${modalId}.html`);
            writeFileSync(modalFilePath, htmlContent, 'utf-8');

            const spinner = !isJson ? ora('Sending modal to UI...').start() : null;

            try {
                const result: any = await api.post(`/api/sessions/${sessionId}/modal`, {
                    modalId,
                    title: cmdOpts.title,
                    html: htmlContent,
                    filePath: modalFilePath,
                });

                spinner?.succeed('Modal sent to UI');

                if (!cmdOpts.interactive) {
                    // Non-interactive mode: just output and exit
                    if (isJson) {
                        outputJSON(result);
                    } else {
                        outputKeyValue('Modal ID', modalId);
                        outputKeyValue('Title', cmdOpts.title);
                        outputKeyValue('File', modalFilePath);
                    }
                    return;
                }

                // Interactive mode: listen for user actions via WebSocket
                if (!isJson) {
                    console.log(`\nListening for user actions on modal ${modalId}...`);
                    console.log('(Press Ctrl+C to stop)\n');
                }

                await listenForModalActions(modalId, sessionId, {
                    isJson,
                    timeoutMs: parseInt(cmdOpts.timeout || '0', 10),
                });
            } catch (err) {
                spinner?.stop();
                handleError(err, isJson);
            }
        });

    // Standalone events listener (for modals already shown)
    const modal = program.command('modal').description('Manage agent modals');

    modal.command('events <modalId>')
        .description('Listen for user actions on a modal (outputs JSONL)')
        .option('--timeout <ms>', 'Auto-exit after N milliseconds (0 = no timeout)', '0')
        .action(async (modalId: string, cmdOpts: any) => {
            await guardCommand('modal:events');
            const globalOpts = program.opts();
            const isJson = globalOpts.json;
            const sessionId = config.sessionId;

            if (!sessionId) {
                const msg = 'No session context found (MAESTRO_SESSION_ID not set).';
                if (isJson) { console.log(JSON.stringify({ success: false, error: msg })); }
                else { console.error(msg); }
                process.exit(1);
            }

            if (!isJson) {
                console.log(`Listening for user actions on modal ${modalId}...`);
                console.log('(Press Ctrl+C to stop)\n');
            }

            await listenForModalActions(modalId, sessionId, {
                isJson,
                timeoutMs: parseInt(cmdOpts.timeout || '0', 10),
            });
        });
}

/**
 * Connect to WebSocket and stream modal action events as JSONL.
 * Exits when the modal is closed or timeout is reached.
 */
async function listenForModalActions(
    modalId: string,
    sessionId: string,
    opts: { isJson: boolean; timeoutMs: number }
): Promise<void> {
    const apiUrl = config.apiUrl;
    const wsUrl = apiUrl.replace(/^http/, 'ws');

    const ws = new WebSocket(wsUrl);
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
            ws.close();
        }
    };

    ws.on('open', () => {
        // Subscribe to this session's events
        ws.send(JSON.stringify({
            type: 'subscribe',
            sessionIds: [sessionId],
        }));

        if (opts.timeoutMs > 0) {
            timeoutHandle = setTimeout(() => {
                if (!opts.isJson) console.log(`[modal:events] Timeout reached (${opts.timeoutMs}ms). Exiting.`);
                cleanup();
            }, opts.timeoutMs);
        }
    });

    ws.on('message', (data: WebSocket.Data) => {
        try {
            const msg = JSON.parse(data.toString());
            const event = msg.event || msg.type;
            const payload = msg.data;

            if (!event || !payload) return;

            // Only process modal_action events for our modal
            if (event === 'session:modal_action' && payload.modalId === modalId) {
                // Output as JSONL — one JSON object per line
                console.log(JSON.stringify({
                    event: 'action',
                    modalId: payload.modalId,
                    action: payload.action,
                    data: payload.data,
                    timestamp: payload.timestamp || msg.timestamp,
                }));
            }

            // Modal closed by user
            if (event === 'session:modal_closed' && payload.modalId === modalId) {
                console.log(JSON.stringify({
                    event: 'closed',
                    modalId: payload.modalId,
                    timestamp: payload.timestamp || msg.timestamp,
                }));
                cleanup();
            }
        } catch {
            // ignore parse errors
        }
    });

    ws.on('error', (err: Error) => {
        if (!opts.isJson) {
            console.error(`[modal:events] WebSocket error: ${err.message}`);
        }
    });

    ws.on('close', () => {
        if (!opts.isJson) {
            console.log(`[modal:events] Disconnected.`);
        }
    });

    // Keep process alive until WS closes
    await new Promise<void>((resolve) => {
        ws.on('close', resolve);
    });
}
