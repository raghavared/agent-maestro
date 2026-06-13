import { create } from "zustand";

export type MobilePanel = "left" | "main" | "right";

interface MobilePanelState {
  activePanel: MobilePanel;
  setActivePanel: (panel: MobilePanel) => void;
}

export const useMobilePanelStore = create<MobilePanelState>((set) => ({
  activePanel: "main",
  setActivePanel: (panel) => set({ activePanel: panel }),
}));
