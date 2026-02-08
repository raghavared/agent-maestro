import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AppInfo } from "../app/types/app-state";
import { UpdateCheckState } from "../components/modals/UpdateModal";

import { formatError } from "../utils/formatters";

export function useAppUpdate() {
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [updatesOpen, setUpdatesOpen] = useState(false);
  const [updateCheckState, setUpdateCheckState] = useState<UpdateCheckState>({ status: "idle" });

  useEffect(() => {
    let cancelled = false;
    invoke<AppInfo>("get_app_info")
      .then((info) => {
        if (cancelled) return;
        setAppInfo(info);
      })
      .catch(() => { });

    return () => {
      cancelled = true;
    };
  }, []);

  const checkForUpdates = useCallback(async () => {
    setUpdateCheckState({ status: "checking" });

    let info: AppInfo | null = null;
    try {
      info = await invoke<AppInfo>("get_app_info");
      setAppInfo(info);
    } catch {
      info = null;
    }

    if (!info) {
      setUpdateCheckState({ status: "error", message: "Unable to read app info." });
      return;
    }

    const repo = parseGithubRepo(info.homepage);
    if (!repo) {
      setUpdateCheckState({
        status: "error",
        message: "Update source not configured. Set bundle.homepage to your GitHub repo URL.",
      });
      return;
    }

    const fallbackReleaseUrl = `https://github.com/${repo.owner}/${repo.repo}/releases/latest`;
    const apiUrl = `https://api.github.com/repos/${repo.owner}/${repo.repo}/releases/latest`;

    try {
      const response = await fetch(apiUrl, {
        headers: { Accept: "application/vnd.github+json" },
      });
      if (!response.ok) {
        throw new Error(`GitHub API returned ${response.status}`);
      }
      const data = (await response.json()) as { tag_name?: string };
      const tag = data.tag_name?.trim();
      if (!tag) {
        setUpdateCheckState({ status: "error", message: "Latest release has no tag name." });
        return;
      }

      const current = info.version;
      const cmp = compareSemver(tag, current);

      const releaseUrl = fallbackReleaseUrl;
      const isNewer =
        cmp === null
          ? tag.trim().replace(/^v/i, "") !== current.trim().replace(/^v/i, "")
          : cmp > 0;

      if (isNewer) {
        setUpdateCheckState({
          status: "updateAvailable",
          latestVersion: tag,
          releaseUrl,
        });
        return;
      }

      setUpdateCheckState({
        status: "upToDate",
        latestVersion: tag,
        releaseUrl,
      });
    } catch (err) {
      setUpdateCheckState({
        status: "error",
        message: `Update check failed: ${formatError(err)}`,
      });
    }
  }, []);

  return {
    appInfo,
    updatesOpen,
    setUpdatesOpen,
    updateCheckState,
    checkForUpdates,
  };
}
