import React, { useCallback, useEffect, useRef, useState } from "react";
import mermaid from "mermaid";
import DOMPurify from "dompurify";

function hexFromRgb(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("")
  );
}

function blendOnBlack(r: number, g: number, b: number, alpha: number): string {
  // Blend rgba color onto #0a0a0a background
  const bg = 10; // 0x0a
  return hexFromRgb(
    Math.round(bg + (r - bg) * alpha),
    Math.round(bg + (g - bg) * alpha),
    Math.round(bg + (b - bg) * alpha)
  );
}

function getThemeColors() {
  const style = getComputedStyle(document.documentElement);
  const rgbStr = style.getPropertyValue("--theme-primary-rgb").trim() || "0, 255, 65";
  const [r, g, b] = rgbStr.split(",").map((s) => parseInt(s.trim(), 10));
  const primary = style.getPropertyValue("--theme-primary").trim() || "#00ff41";
  const textColor = style.getPropertyValue("--text").trim() || "#e0e0e0";

  return {
    darkMode: true,
    background: "#0a0a0a",
    primaryColor: blendOnBlack(r, g, b, 0.2),
    primaryBorderColor: primary,
    primaryTextColor: textColor,
    secondaryColor: blendOnBlack(r, g, b, 0.08),
    tertiaryColor: "#0a0a0a",
    lineColor: "#4d4d4d",
    textColor: textColor,
    mainBkg: blendOnBlack(r, g, b, 0.06),
    nodeBorder: blendOnBlack(r, g, b, 0.4),
    clusterBkg: blendOnBlack(r, g, b, 0.03),
    clusterBorder: blendOnBlack(r, g, b, 0.15),
    edgeLabelBackground: "#0a0a0a",
    fontSize: "12px",
  };
}

function reinitMermaid() {
  mermaid.initialize({
    startOnLoad: false,
    theme: "base",
    securityLevel: "strict",
    fontFamily: "'JetBrains Mono', monospace",
    themeVariables: getThemeColors(),
  });
}

interface MermaidDiagramProps {
  chart: string;
}

let diagramCounter = 0;

const ZOOM_MIN = 0.25;
const ZOOM_MAX = 5;
const ZOOM_STEP = 0.25;

export function MermaidDiagram({ chart }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayContentRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);

  // Reset zoom when opening overlay
  const openZoom = useCallback(() => {
    setZoomLevel(1);
    setIsZoomed(true);
  }, []);

  const closeZoom = useCallback(() => {
    setIsZoomed(false);
    setZoomLevel(1);
  }, []);

  const zoomIn = useCallback(() => {
    setZoomLevel((z) => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2)));
  }, []);

  const zoomOut = useCallback(() => {
    setZoomLevel((z) => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2)));
  }, []);

  const zoomReset = useCallback(() => setZoomLevel(1), []);

  // Scroll-wheel zoom inside overlay
  useEffect(() => {
    if (!isZoomed) return;
    const el = overlayContentRef.current;
    if (!el) return;

    function handleWheel(e: WheelEvent) {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
        setZoomLevel((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, +(z + delta).toFixed(2))));
      }
    }

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [isZoomed]);

  // Keyboard shortcuts in overlay
  useEffect(() => {
    if (!isZoomed) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") { closeZoom(); return; }
      if (e.key === "=" || e.key === "+") { zoomIn(); return; }
      if (e.key === "-") { zoomOut(); return; }
      if (e.key === "0") { zoomReset(); return; }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isZoomed, closeZoom, zoomIn, zoomOut, zoomReset]);

  useEffect(() => {
    let cancelled = false;
    const id = `mermaid-diagram-${++diagramCounter}`;

    async function renderDiagram() {
      try {
        reinitMermaid();
        const { svg } = await mermaid.render(id, chart.trim());
        if (!cancelled) {
          setSvgContent(svg);
          setError(null);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "Failed to render diagram");
          setSvgContent(null);
        }
        // Clean up any leftover error container mermaid may have inserted
        const errorEl = document.getElementById("d" + id);
        if (errorEl) errorEl.remove();
      }
    }

    renderDiagram();
    return () => { cancelled = true; };
  }, [chart]);

  if (error) {
    return (
      <div className="mermaidDiagramError">
        <div className="mermaidDiagramErrorHeader">
          <span className="mermaidDiagramErrorIcon">!</span>
          <span>Diagram render failed</span>
        </div>
        <pre className="mermaidDiagramErrorDetail">{error}</pre>
        <pre className="mermaidDiagramFallback"><code>{chart}</code></pre>
      </div>
    );
  }

  if (!svgContent) {
    return (
      <div className="mermaidDiagramLoading">
        <span className="mermaidDiagramSpinner" />
        <span>Rendering diagram...</span>
      </div>
    );
  }

  const sanitizedSvg = DOMPurify.sanitize(svgContent, { USE_PROFILES: { svg: true, svgFilters: true } });

  return (
    <>
      <div
        ref={containerRef}
        className={`mermaidDiagram ${isZoomed ? "mermaidDiagram--zoomed" : ""}`}
        onClick={openZoom}
        dangerouslySetInnerHTML={{ __html: sanitizedSvg }}
      />
      {isZoomed && (
        <div className="mermaidDiagramOverlay" onClick={closeZoom}>
          <div
            ref={overlayContentRef}
            className="mermaidDiagramOverlayContent"
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" className="mermaidDiagramOverlayClose" onClick={closeZoom}>
              ✕
            </button>

            {/* Zoom controls toolbar */}
            <div className="mermaidZoomControls" onClick={(e) => e.stopPropagation()}>
              <button type="button" className="mermaidZoomBtn" onClick={zoomOut} disabled={zoomLevel <= ZOOM_MIN} title="Zoom out (-)">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 8h10" /></svg>
              </button>
              <button type="button" className="mermaidZoomLevel" onClick={zoomReset} title="Reset zoom (0)">
                {Math.round(zoomLevel * 100)}%
              </button>
              <button type="button" className="mermaidZoomBtn" onClick={zoomIn} disabled={zoomLevel >= ZOOM_MAX} title="Zoom in (+)">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M8 3v10" /><path d="M3 8h10" /></svg>
              </button>
            </div>

            <div
              className="mermaidDiagramOverlaySvg"
              style={{ transform: `scale(${zoomLevel})`, transformOrigin: "center top" }}
              dangerouslySetInnerHTML={{ __html: sanitizedSvg }}
            />
          </div>
        </div>
      )}
    </>
  );
}
