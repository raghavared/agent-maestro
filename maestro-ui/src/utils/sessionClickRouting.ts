import type { MaestroSession } from '../app/types/maestro';

// Minimum shape we need from linkMap entries. Kept local so this util doesn't
// pull a circular import from SessionsSection.
export interface ClickRoutingLink {
  exited: boolean;
}

/**
 * The agent is "busy" — actively producing work or waiting on input — and
 * therefore a live terminal is the right thing to surface on click.
 */
export function agentIsBusy(
  session: Pick<MaestroSession, 'status' | 'needsInput'>,
): boolean {
  return (
    session.status === 'working' ||
    session.status === 'spawning' ||
    Boolean(session.needsInput?.active)
  );
}

/**
 * Single source of truth for the tile-click predicate. True ⇔ clicking the
 * tile would route to SessionStatsView (not a live terminal). Used both to:
 *   - decide what handleSelectTile does
 *   - decide whether the tile's Resume button is rendered
 *   - decide the tile's click-affordance dot
 *
 * Resume button visibility ⟺ willOpenStatsOnClick — locked invariant.
 */
export function willOpenStatsOnClick(
  session: Pick<MaestroSession, 'status' | 'needsInput'>,
  link: ClickRoutingLink | null,
): boolean {
  const hasLivePty = Boolean(link && !link.exited);
  return !(agentIsBusy(session) && hasLivePty);
}
