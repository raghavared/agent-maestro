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
 * Rule: a live PTY is a real terminal the user can see and type into, so it
 * ALWAYS wins on click — even when the agent has gone idle between turns. This
 * keeps the resume UX coherent: once you resume a session and it has a live
 * terminal, clicking its tile (after switching away and back) re-opens that
 * terminal instead of swapping in a stats view. Stats are reserved for
 * sessions whose terminal has actually exited.
 *
 * Resume button visibility ⟺ willOpenStatsOnClick — locked invariant.
 */
export function willOpenStatsOnClick(
  _session: Pick<MaestroSession, 'status' | 'needsInput'>,
  link: ClickRoutingLink | null,
): boolean {
  const hasLivePty = Boolean(link && !link.exited);
  return !hasLivePty;
}
