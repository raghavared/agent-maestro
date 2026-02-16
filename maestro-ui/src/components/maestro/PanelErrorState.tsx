import React from "react";

type PanelErrorStateProps = {
    error: Error;
    onRetry: () => void;
    onClose: () => void;
};

export const PanelErrorState: React.FC<PanelErrorStateProps> = ({ error, onRetry, onClose }) => (
    <div className="maestroPanel terminalTheme">
        <div className="terminalWindowChrome">
            <div className="terminalWindowButtons">
                <span className="terminalWindowBtn terminalWindowBtnClose" onClick={onClose}>●</span>
                <span className="terminalWindowBtn terminalWindowBtnMinimize">●</span>
                <span className="terminalWindowBtn terminalWindowBtnMaximize">●</span>
            </div>
            <div className="terminalWindowTitle">
                <span className="terminalPromptSymbol">❯</span>
                maestro-agent [ERROR]
            </div>
            <div className="terminalWindowSpacer"></div>
        </div>
        <div className="terminalContent">
            <div className="terminalErrorState">
                <pre className="terminalErrorAscii">{`
    ╔═══════════════════════════════════════╗
    ║     ⚠️  FATAL ERROR                   ║
    ╚═══════════════════════════════════════╝
                `}</pre>
                <div className="terminalErrorBox">
                    <span className="terminalErrorLabel">[TRACEBACK]</span>
                    <pre className="terminalErrorMessage">{error.message}</pre>
                </div>
                <p className="terminalErrorHint">
                    → Check DevTools console (Cmd+Option+I) for stack trace
                </p>
                <button
                    className="terminalCmd terminalCmdPrimary"
                    onClick={onRetry}
                >
                    <span className="terminalPrompt">$</span> retry
                </button>
            </div>
        </div>
    </div>
);

type NoProjectStateProps = {
    onClose: () => void;
};

export const NoProjectState: React.FC<NoProjectStateProps> = ({ onClose }) => (
    <div className="maestroPanel terminalTheme">
        <div className="terminalWindowChrome">
            <div className="terminalWindowButtons">
                <span className="terminalWindowBtn terminalWindowBtnClose" onClick={onClose}>●</span>
                <span className="terminalWindowBtn terminalWindowBtnMinimize">●</span>
                <span className="terminalWindowBtn terminalWindowBtnMaximize">●</span>
            </div>
            <div className="terminalWindowTitle">
                <span className="terminalPromptSymbol">❯</span>
                maestro-agent [IDLE]
            </div>
            <div className="terminalWindowSpacer"></div>
        </div>
        <div className="terminalContent">
            <div className="terminalEmptyState">
                <pre className="terminalAsciiArt">{`
    ╔═══════════════════════════════════════╗
    ║                                       ║
    ║        NO PROJECT LOADED              ║
    ║                                       ║
    ║     Please select or create a         ║
    ║     project to use Maestro            ║
    ║                                       ║
    ╚═══════════════════════════════════════╝
                `}</pre>
            </div>
        </div>
    </div>
);
