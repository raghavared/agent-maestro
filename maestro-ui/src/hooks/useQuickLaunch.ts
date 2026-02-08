import { useMemo } from "react";
import { TerminalSession } from "../app/types/session";
import { getProcessEffectById, PROCESS_EFFECTS } from "../processEffects";

interface UseQuickLaunchProps {
    agentShortcutIds: string[];
    sessions: TerminalSession[];
}

export function useQuickLaunch({ agentShortcutIds, sessions }: UseQuickLaunchProps) {
    const quickStarts = useMemo(() => {
        const presets: Array<{ id: string; title: string; command: string | null; iconSrc: string | null }> = [];

        const seen = new Set<string>();
        for (const id of agentShortcutIds) {
            if (seen.has(id)) continue;
            seen.add(id);
            const effect = getProcessEffectById(id);
            if (!effect) continue;
            presets.push({
                id: effect.id,
                title: effect.label,
                command: effect.matchCommands[0] ?? effect.label,
                iconSrc: effect.iconSrc ?? null,
            });
        }

        const pinned = new Set(presets.map((p) => p.id));
        const rest = PROCESS_EFFECTS
            .filter((e) => !pinned.has(e.id))
            .slice()
            .sort((a, b) => a.label.toLowerCase().localeCompare(b.label.toLowerCase()))
            .map((effect) => ({
                id: effect.id,
                title: effect.label,
                command: effect.matchCommands[0] ?? effect.label,
                iconSrc: effect.iconSrc ?? null,
            }));

        return [
            ...presets,
            ...rest,
            { id: "shell", title: "shell", command: null as string | null, iconSrc: null as string | null },
        ];
    }, [agentShortcutIds]);

    const commandSuggestions = useMemo(() => {
        const out: string[] = [];
        const seen = new Set<string>();
        const add = (raw: string | null | undefined) => {
            const trimmed = (raw ?? "").trim();
            if (!trimmed) return;
            if (seen.has(trimmed)) return;
            seen.add(trimmed);
            out.push(trimmed);
        };

        sessions
            .slice()
            .sort((a, b) => b.createdAt - a.createdAt)
            .forEach((s) => {
                add(s.launchCommand ?? null);
                add((s.restoreCommand ?? null) as string | null);
            });

        for (const preset of quickStarts) add(preset.command ?? null);
        for (const effect of PROCESS_EFFECTS) for (const cmd of effect.matchCommands) add(cmd);

        return out.slice(0, 50);
    }, [sessions, quickStarts]);

    const agentShortcuts = useMemo(() => {
        const seen = new Set<string>();
        return agentShortcutIds
            .filter((id) => {
                if (seen.has(id)) return false;
                seen.add(id);
                return true;
            })
            .map((id) => getProcessEffectById(id))
            .filter((effect): effect is NonNullable<ReturnType<typeof getProcessEffectById>> => Boolean(effect));
    }, [agentShortcutIds]);

    return {
        quickStarts,
        commandSuggestions,
        agentShortcuts,
    };
}
