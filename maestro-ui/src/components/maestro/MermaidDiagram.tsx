import React, { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";

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

export function MermaidDiagram({ chart }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);

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

  return (
    <>
      <div
        ref={containerRef}
        className={`mermaidDiagram ${isZoomed ? "mermaidDiagram--zoomed" : ""}`}
        onClick={() => setIsZoomed(!isZoomed)}
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />
      {isZoomed && (
        <div className="mermaidDiagramOverlay" onClick={() => setIsZoomed(false)}>
          <div className="mermaidDiagramOverlayContent" onClick={(e) => e.stopPropagation()}>
            <button className="mermaidDiagramOverlayClose" onClick={() => setIsZoomed(false)}>
              ✕
            </button>
            <div
              className="mermaidDiagramOverlaySvg"
              dangerouslySetInnerHTML={{ __html: svgContent }}
            />
          </div>
        </div>
      )}
    </>
  );
}
