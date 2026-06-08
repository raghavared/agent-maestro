import { useMaestroStore } from '../stores/useMaestroStore';

export function isCoordinatorRole(mode: string | undefined | null): boolean {
  return mode === 'coordinator' || mode === 'coordinated-coordinator';
}

export function useIsSessionCoordinator(sessionId: string): boolean {
  return useMaestroStore((s) => isCoordinatorRole(s.sessions[sessionId]?.mode));
}
