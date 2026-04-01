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
                        id: s.id,
                        display: s.name,
                        description: s.description,
                        scope: s.skillScope,
                    })));
                })
                .catch(() => {});
        }
    }, [isOpen, projectPath]);

    return skills;
}
