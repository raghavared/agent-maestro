import { useState, useEffect } from "react";
import { maestroClient } from "../utils/MaestroClient";

type SkillEntry = { id: string; display: string; description?: string; scope?: string };

export function useSkillAutocomplete(projectPath: string | null | undefined, isOpen: boolean) {
    const [skills, setSkills] = useState<SkillEntry[]>([]);

    useEffect(() => {
        if (isOpen) {
            maestroClient.getSkills(projectPath || undefined)
                .then(skillsList => {
                    setSkills(skillsList.map(s => ({
                        id: String(s.id || ''),
                        display: String(s.name || s.id || ''),
                        description: typeof s.description === 'string' ? s.description : '',
                        scope: typeof s.skillScope === 'string' ? s.skillScope : undefined,
                    })));
                })
                .catch(() => {});
        }
    }, [isOpen, projectPath]);

    return skills;
}
