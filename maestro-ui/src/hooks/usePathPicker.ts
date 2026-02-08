import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { DirectoryListing } from "../app/types/app-state";
import { formatError } from "../utils/formatters";

export function usePathPicker() {
    const [pathPickerOpen, setPathPickerOpen] = useState(false);
    const [pathPickerTarget, setPathPickerTarget] = useState<"project" | "session" | null>(null);
    const [pathPickerListing, setPathPickerListing] = useState<DirectoryListing | null>(null);
    const [pathPickerInput, setPathPickerInput] = useState("");
    const [pathPickerLoading, setPathPickerLoading] = useState(false);
    const [pathPickerError, setPathPickerError] = useState<string | null>(null);

    async function loadPathPicker(path: string | null) {
        setPathPickerLoading(true);
        setPathPickerError(null);
        try {
            const listing = await invoke<DirectoryListing>("list_directories", { path });
            setPathPickerListing(listing);
            setPathPickerInput(listing.path);
        } catch (err) {
            setPathPickerError(formatError(err));
        } finally {
            setPathPickerLoading(false);
        }
    }

    function openPathPicker(target: "project" | "session", initial: string | null) {
        setPathPickerTarget(target);
        setPathPickerOpen(true);
        void loadPathPicker(initial);
    }

    function closePathPicker() {
        setPathPickerOpen(false);
        setPathPickerTarget(null);
    }

    return {
        pathPickerOpen,
        setPathPickerOpen,
        pathPickerTarget,
        setPathPickerTarget,
        pathPickerListing,
        setPathPickerListing,
        pathPickerInput,
        setPathPickerInput,
        pathPickerLoading,
        setPathPickerLoading,
        pathPickerError,
        setPathPickerError,
        loadPathPicker,
        openPathPicker,
        closePathPicker, // Added helper to cleaner closing in App.tsx
    };
}
