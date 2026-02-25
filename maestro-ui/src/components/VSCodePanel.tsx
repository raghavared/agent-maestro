import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";

type VSCodePanelProps = {
  basePath?: string | null;
};

export function VSCodePanel({ basePath }: VSCodePanelProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const retriesRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    retriesRef.current = 0;
    setUrl(null);
    setError(null);
    setLoading(true);

    const tryConnect = async () => {
      try {
        const baseUrl = await invoke<string>("get_code_server_url");
        if (cancelled) return;

        // Health-check: wait until code-server is actually accepting connections
        // before mounting the iframe (prevents "Could not connect to server" flash).
        try {
          await fetch(baseUrl, { method: "HEAD", mode: "no-cors" });
        } catch {
          if (cancelled) return;
          retriesRef.current += 1;
          if (retriesRef.current >= 20) {
            setError("Could not connect to code-server: server not responding");
            setLoading(false);
            return;
          }
          timerRef.current = window.setTimeout(() => {
            if (!cancelled) void tryConnect();
          }, 1000);
          return;
        }

        if (cancelled) return;
        const fullUrl = basePath
          ? `${baseUrl}?folder=${encodeURIComponent(basePath)}`
          : baseUrl;
        setUrl(fullUrl);
        setLoading(false);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        retriesRef.current += 1;
        if (retriesRef.current >= 10) {
          setError(
            `Could not connect to code-server: ${err instanceof Error ? err.message : String(err)}`
          );
          setLoading(false);
          return;
        }
        timerRef.current = window.setTimeout(() => {
          if (!cancelled) void tryConnect();
        }, 1000);
      }
    };

    void tryConnect();

    return () => {
      cancelled = true;
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [basePath]);

  if (loading) {
    return (
      <div className="vsCodePanel">
        <div className="vsCodePanelLoading">Starting VS Code...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="vsCodePanel">
        <div className="vsCodePanelError">{error}</div>
      </div>
    );
  }

  if (!url) return null;

  return (
    <div className="vsCodePanel">
      <iframe
        className="vsCodeIframe"
        src={url}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
        allow="clipboard-read; clipboard-write"
        title="VS Code"
      />
    </div>
  );
}
