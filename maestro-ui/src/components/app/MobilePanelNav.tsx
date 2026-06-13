import React from "react";
import { useMobilePanelStore, type MobilePanel } from "../../stores/useMobilePanelStore";

const TABS: Array<{ panel: MobilePanel; label: string; icon: string }> = [
  { panel: "left", label: "Sidebar", icon: "☰" },
  { panel: "main", label: "Terminal", icon: "⌨" },
  { panel: "right", label: "Sessions", icon: "⊞" },
];

export function MobilePanelNav() {
  const activePanel = useMobilePanelStore((s) => s.activePanel);
  const setActivePanel = useMobilePanelStore((s) => s.setActivePanel);

  return (
    <nav className="mobilePanelNav" aria-label="Panel navigation">
      {TABS.map(({ panel, label, icon }) => (
        <button
          key={panel}
          type="button"
          className={`mobilePanelNavTab${activePanel === panel ? " mobilePanelNavTab--active" : ""}`}
          onClick={() => setActivePanel(panel)}
          aria-pressed={activePanel === panel}
          aria-label={label}
        >
          <span className="mobilePanelNavIcon">{icon}</span>
          <span className="mobilePanelNavLabel">{label}</span>
        </button>
      ))}
    </nav>
  );
}
