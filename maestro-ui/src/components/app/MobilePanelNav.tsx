import React from "react";
import { useMobilePanelStore, type MobilePanel, type MobileMainView } from "../../stores/useMobilePanelStore";
import { useWorkspaceStore, getActiveWorkspaceView } from "../../stores/useWorkspaceStore";
import { useSessionStore } from "../../stores/useSessionStore";
import { useProjectStore } from "../../stores/useProjectStore";
import { isWhiteboardId, isFileId } from "../../app/types/space";

type Tab =
  | { kind: "panel"; key: string; panel: MobilePanel; label: string; icon: string }
  | { kind: "main"; key: string; mainView: MobileMainView; label: string; icon: string };

export function MobilePanelNav() {
  const activePanel = useMobilePanelStore((s) => s.activePanel);
  const setActivePanel = useMobilePanelStore((s) => s.setActivePanel);
  const mainView = useMobilePanelStore((s) => s.mainView);
  const setMainView = useMobilePanelStore((s) => s.setMainView);

  // Subscribe so we re-render when panes open/close or context changes.
  useWorkspaceStore((s) => s.workspaceViewByKey);
  const activeId = useSessionStore((s) => s.activeId);
  useProjectStore((s) => s.activeProjectId);

  const view = getActiveWorkspaceView();
  const editorOpen = view.codeEditorOpen;
  const filesOpen = view.fileExplorerOpen;

  const primary = (() => {
    if (activeId && isWhiteboardId(activeId)) return { label: "Board", icon: "✎" };
    if (activeId && isFileId(activeId)) return { label: "File", icon: "📄" };
    return { label: "Terminal", icon: "⌨" };
  })();

  const tabs: Tab[] = [
    { kind: "panel", key: "left", panel: "left", label: "Sidebar", icon: "☰" },
    { kind: "main", key: "primary", mainView: "primary", label: primary.label, icon: primary.icon },
  ];
  if (editorOpen) {
    tabs.push({ kind: "main", key: "editor", mainView: "editor", label: "Editor", icon: "</>" });
  }
  if (filesOpen) {
    tabs.push({ kind: "main", key: "files", mainView: "files", label: "Files", icon: "▤" });
  }
  tabs.push({ kind: "panel", key: "right", panel: "right", label: "Sessions", icon: "⊞" });

  const isTabActive = (tab: Tab): boolean => {
    if (tab.kind === "panel") return activePanel === tab.panel;
    // main-kind tabs are only active when the outer panel is "main"
    if (activePanel !== "main") return false;
    const effective: MobileMainView =
      (mainView === "editor" && !editorOpen) || (mainView === "files" && !filesOpen)
        ? "primary"
        : mainView;
    return effective === tab.mainView;
  };

  const onTabClick = (tab: Tab) => {
    if (tab.kind === "panel") {
      setActivePanel(tab.panel);
    } else {
      setActivePanel("main");
      setMainView(tab.mainView);
    }
  };

  return (
    <nav className="mobilePanelNav" aria-label="Panel navigation">
      {tabs.map((tab) => {
        const active = isTabActive(tab);
        return (
          <button
            key={tab.key}
            type="button"
            className={`mobilePanelNavTab${active ? " mobilePanelNavTab--active" : ""}`}
            onClick={() => onTabClick(tab)}
            aria-pressed={active}
            aria-label={tab.label}
          >
            <span className="mobilePanelNavIcon">{tab.icon}</span>
            <span className="mobilePanelNavLabel">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
