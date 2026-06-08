import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { usePromptAnimationStore, PromptAnimation, PromptSurface } from '../stores/usePromptAnimationStore';

/**
 * Renders prompt-travel animations when a session sends a prompt to another session.
 * Mounted once at App level — uses a portal to render over everything.
 *
 * Surfaces (chosen at the event boundary in useMaestroStore):
 *  - 'tree' → arc between session tiles in the expanded Sessions tree
 *  - 'rail' → sender-initial puck gliding between Spaces-rail session icons (same project)
 *  - 'bar'  → accent dot gliding along the project bar between tabs (cross project)
 *
 * All variants are cosmetic & best-effort: a missing anchor degrades to a pulse or no-op,
 * and never affects message delivery.
 */
export function PromptSendAnimationLayer() {
  const animations = usePromptAnimationStore((s) => s.animations);

  if (animations.length === 0) return null;

  return createPortal(
    <div className="promptAnimLayer">
      {animations.map((anim) => {
        switch (anim.surface) {
          case 'rail':
            return <RailPuck key={anim.id} animation={anim} />;
          case 'bar':
            return <BarDot key={anim.id} animation={anim} />;
          case 'tree':
          default:
            return <TreeDot key={anim.id} animation={anim} />;
        }
      })}
    </div>,
    document.body,
  );
}

/* ── shared helpers ── */

function getAnchor(surface: PromptSurface, id: string): HTMLElement | null {
  if (surface === 'bar') {
    return document.querySelector(`.projectTab[data-project-id="${id}"]`);
  }
  if (surface === 'rail') {
    return document.querySelector(`.spacesRailSession[data-maestro-session-id="${id}"]`);
  }
  // tree (scope to the tree node, fall back to any anchor)
  return (
    document.querySelector(`.sessionTreeNode[data-maestro-session-id="${id}"]`) ??
    document.querySelector(`[data-maestro-session-id="${id}"]`)
  );
}

function getCenter(el: HTMLElement): { x: number; y: number } {
  const rect = el.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function accentVars(accent?: string): React.CSSProperties {
  return accent ? ({ '--prompt-accent': accent } as React.CSSProperties) : {};
}

/* ── Tree: arc between two session tiles (legacy behavior, now accent-aware) ── */

function TreeDot({ animation }: { animation: PromptAnimation }) {
  const [style, setStyle] = useState<React.CSSProperties | null>(null);
  const [targetPulse, setTargetPulse] = useState<{ x: number; y: number } | null>(null);
  const hasStarted = useRef(false);

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    const targetEl = getAnchor('tree', animation.targetMaestroSessionId);
    if (!targetEl) return;

    const targetPos = getCenter(targetEl);
    if (animation.accent) targetEl.style.setProperty('--prompt-accent', animation.accent);
    targetEl.classList.add('promptTarget--receiving');
    const cleanupTimer = setTimeout(() => {
      targetEl.classList.remove('promptTarget--receiving');
      targetEl.style.removeProperty('--prompt-accent');
    }, 1400);

    const reduced = prefersReducedMotion();
    const senderEl = animation.senderMaestroSessionId
      ? getAnchor('tree', animation.senderMaestroSessionId)
      : null;

    if (senderEl && !reduced) {
      const senderPos = getCenter(senderEl);
      if (animation.accent) senderEl.style.setProperty('--prompt-accent', animation.accent);
      senderEl.classList.add('promptSender--sending');
      setTimeout(() => {
        senderEl.classList.remove('promptSender--sending');
        senderEl.style.removeProperty('--prompt-accent');
      }, 800);

      // Parent/child pairs hug the tree's left connector edge (near-vertical glide);
      // everyone else arcs up and over.
      const midX = animation.edgeTravel
        ? Math.min(senderPos.x, targetPos.x) - 12
        : (senderPos.x + targetPos.x) / 2;
      const midY = animation.edgeTravel
        ? (senderPos.y + targetPos.y) / 2
        : Math.min(senderPos.y, targetPos.y) - 40;

      setStyle({
        ...accentVars(animation.accent),
        '--start-x': `${senderPos.x}px`,
        '--start-y': `${senderPos.y}px`,
        '--mid-x': `${midX}px`,
        '--mid-y': `${midY}px`,
        '--end-x': `${targetPos.x}px`,
        '--end-y': `${targetPos.y}px`,
      } as React.CSSProperties);

      setTimeout(() => setTargetPulse(targetPos), 700);
      return () => clearTimeout(cleanupTimer);
    }

    // Fallback / reduced motion: pulse the target only.
    setTargetPulse(targetPos);
    return () => clearTimeout(cleanupTimer);
  }, [animation]);

  return (
    <>
      {style && <div className="promptFlyingDot" style={style} />}
      {targetPulse && (
        <div
          className="promptTargetPulse"
          style={{ ...accentVars(animation.accent), left: targetPulse.x, top: targetPulse.y }}
        />
      )}
    </>
  );
}

/* ── Rail: sender-initial puck gliding between Spaces-rail icons (same project) ── */

function RailPuck({ animation }: { animation: PromptAnimation }) {
  const [style, setStyle] = useState<React.CSSProperties | null>(null);
  const [targetPulse, setTargetPulse] = useState<{ x: number; y: number } | null>(null);
  const hasStarted = useRef(false);

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    const targetEl = getAnchor('rail', animation.targetMaestroSessionId);
    if (!targetEl) return; // both missing → no-op

    const targetPos = getCenter(targetEl);
    const reduced = prefersReducedMotion();
    const senderEl = animation.senderMaestroSessionId
      ? getAnchor('rail', animation.senderMaestroSessionId)
      : null;

    if (senderEl && !reduced) {
      const senderPos = getCenter(senderEl);
      setStyle({
        ...accentVars(animation.accent),
        '--start-x': `${senderPos.x}px`,
        '--start-y': `${senderPos.y}px`,
        '--end-x': `${targetPos.x}px`,
        '--end-y': `${targetPos.y}px`,
      } as React.CSSProperties);
      setTimeout(() => setTargetPulse(targetPos), 600);
      return;
    }

    // Sender icon missing (or reduced motion) → pulse the target only.
    setTargetPulse(targetPos);
  }, [animation]);

  return (
    <>
      {style && (
        <div className="promptRailPuck" style={style}>
          {animation.senderInitial ?? '·'}
        </div>
      )}
      {targetPulse && (
        <div
          className="promptTargetPulse"
          style={{ ...accentVars(animation.accent), left: targetPulse.x, top: targetPulse.y }}
        />
      )}
    </>
  );
}

/* ── Bar: accent dot gliding along the project bar between tabs (cross project) ── */

function BarDot({ animation }: { animation: PromptAnimation }) {
  const [style, setStyle] = useState<React.CSSProperties | null>(null);
  const hasStarted = useRef(false);

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    const senderId = animation.senderProjectId;
    const targetId = animation.targetProjectId;
    const senderEl = senderId ? getAnchor('bar', senderId) : null;
    const targetEl = targetId ? getAnchor('bar', targetId) : null;

    if (!senderEl && !targetEl) return; // both off-screen → no-op (timeline still records)

    const glow = (el: HTMLElement | null) => {
      if (!el) return;
      el.classList.add('projectTab--msgGlow');
      setTimeout(() => el.classList.remove('projectTab--msgGlow'), 600);
    };
    glow(senderEl);
    glow(targetEl);

    const reduced = prefersReducedMotion();

    // Need both endpoints (and motion allowed) to travel.
    if (!senderEl || !targetEl || reduced) {
      return;
    }

    const senderRect = senderEl.getBoundingClientRect();
    const targetRect = targetEl.getBoundingClientRect();
    const barY = senderRect.top + senderRect.height / 2;

    // Clamp x to the visible bar so an off-screen (overflow-scrolled) tab makes the
    // dot travel toward the bar edge in its direction rather than off into space.
    const bar = senderEl.closest('.projectTabBar') as HTMLElement | null;
    const clampX = (x: number): number => {
      if (!bar) return x;
      const r = bar.getBoundingClientRect();
      return Math.max(r.left + 6, Math.min(r.right - 6, x));
    };
    const startX = clampX(senderRect.left + senderRect.width / 2);
    const endX = clampX(targetRect.left + targetRect.width / 2);

    setStyle({
      ...accentVars(animation.accent),
      '--start-x': `${startX}px`,
      '--end-x': `${endX}px`,
      '--bar-y': `${barY}px`,
    } as React.CSSProperties);
  }, [animation]);

  return <>{style && <div className="promptBarDot" style={style} />}</>;
}
