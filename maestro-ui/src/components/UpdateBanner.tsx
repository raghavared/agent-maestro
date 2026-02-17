import React from "react";
import { useUIStore } from "../stores/useUIStore";

export function UpdateBanner() {
  const updateCheckState = useUIStore((s) => s.updateCheckState);
  const dismissedVersion = useUIStore((s) => s.updateBannerDismissedVersion);
  const dismissUpdateBanner = useUIStore((s) => s.dismissUpdateBanner);
  const appInfo = useUIStore((s) => s.appInfo);

  if (updateCheckState.status !== "updateAvailable") return null;
  if (dismissedVersion === updateCheckState.latestVersion) return null;

  const currentVersion = appInfo?.version ?? "unknown";

  return (
    <div className="updateBanner">
      <span className="updateBannerText">
        New version <strong>{updateCheckState.latestVersion}</strong> available.
        You have v{currentVersion}.
      </span>
      <button
        type="button"
        className="updateBannerBtn"
        onClick={() => window.open(updateCheckState.releaseUrl, "_blank")}
      >
        Download
      </button>
      <button
        type="button"
        className="updateBannerClose"
        onClick={dismissUpdateBanner}
        aria-label="Dismiss update banner"
      >
        &times;
      </button>
    </div>
  );
}
