import React, { useState, useRef, useEffect } from "react";
import { PROCESS_EFFECTS, type ProcessEffect } from "../../processEffects";

type AgentSelectorProps = {
    selectedAgentId: string;
    onSelectAgent: (agentId: string) => void;
    compact?: boolean;
};

// Show available agents including "which" (spawn terminal without command)
const MAESTRO_AGENTS = [
    ...PROCESS_EFFECTS.filter(e =>
        e.id === 'claude' || e.id === 'gemini' || e.id === 'codex'
    ),
    {
        id: 'which',
        label: 'which',
        command: '',
        description: 'Spawn terminal without initial command',
        matchCommands: []
    }
];

// Agent icons mapping
const AGENT_ICONS: Record<string, string> = {
    claude: '◉',
    gemini: '◈',
    codex: '◆',
    which: '◇'
};

export function AgentSelector({ selectedAgentId, onSelectAgent, compact = false }: AgentSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const selectedAgent = MAESTRO_AGENTS.find(a => a.id === selectedAgentId) || MAESTRO_AGENTS[0];

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handleSelect = (agentId: string) => {
        onSelectAgent(agentId);
        setIsOpen(false);
    };

    return (
        <div
            ref={dropdownRef}
            className="maestroAgentSelector"
            onClick={(e) => e.stopPropagation()}
        >
            <button
                className="maestroAgentSelectorTrigger"
                onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(!isOpen);
                }}
                type="button"
            >
                <span className="maestroAgentIcon">{AGENT_ICONS[selectedAgent.id] || '◉'}</span>
                <span className="maestroAgentLabel">{selectedAgent.label}</span>
                <span className="maestroAgentCaret">{isOpen ? '▴' : '▾'}</span>
            </button>

            {isOpen && (
                <div className="maestroAgentDropdown">
                    {MAESTRO_AGENTS.map((agent) => (
                        <button
                            key={agent.id}
                            className={`maestroAgentOption ${agent.id === selectedAgentId ? 'selected' : ''}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                handleSelect(agent.id);
                            }}
                            type="button"
                        >
                            <span className="maestroAgentIcon">{AGENT_ICONS[agent.id] || '◉'}</span>
                            <div className="maestroAgentOptionContent">
                                <span className="maestroAgentOptionLabel">{agent.label}</span>
                            
                            </div>
                            {agent.id === selectedAgentId && (
                                <span className="maestroAgentCheck">✓</span>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

export function getAgentById(agentId: string): ProcessEffect | null {
    return MAESTRO_AGENTS.find(a => a.id === agentId) || null;
}

export function getDefaultAgent(): ProcessEffect {
    return MAESTRO_AGENTS.find(a => a.id === 'claude') || MAESTRO_AGENTS[0];
}
