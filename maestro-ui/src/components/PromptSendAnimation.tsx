import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { usePromptAnimationStore, PromptAnimation } from '../stores/usePromptAnimationStore';

/**
 * Renders flying dot animations when a session sends a prompt to another session.
 * Mounted once at App level — uses portals to render over everything.
 */
export function PromptSendAnimationLayer() {
  const animations = usePromptAnimationStore((s) => s.animations);

  if (animations.length === 0) return null;

  return createPortal(
    <div className="promptAnimLayer">
      {animations.map((anim) => (
        <FlyingDot key={anim.id} animation={anim} />
      ))}
    </div>,
    document.body,
  );
}

function getSessionElement(maestroSessionId: string): HTMLElement | null {
  return document.querySelector(`[data-maestro-session-id="${maestroSessionId}"]`);
}

function getCenter(el: HTMLElement): { x: number; y: number } {
  const rect = el.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function FlyingDot({ animation }: { animation: PromptAnimation }) {
  const [style, setStyle] = useState<React.CSSProperties | null>(null);
  const [targetPulse, setTargetPulse] = useState<{ x: number; y: number } | null>(null);
  const hasStarted = useRef(false);

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    const targetEl = getSessionElement(animation.targetMaestroSessionId);
    if (!targetEl) return;

    const targetPos = getCenter(targetEl);

    // Add highlight class to target
    targetEl.classList.add('promptTarget--receiving');
    const cleanupTimer = setTimeout(() => {
      targetEl.classList.remove('promptTarget--receiving');
    }, 1400);

    if (animation.senderMaestroSessionId) {
      const senderEl = getSessionElement(animation.senderMaestroSessionId);
      if (senderEl) {
        const senderPos = getCenter(senderEl);

        // Add sending class to sender
        senderEl.classList.add('promptSender--sending');
        setTimeout(() => senderEl.classList.remove('promptSender--sending'), 800);

        // Calculate a curved midpoint for the arc
        const midX = (senderPos.x + targetPos.x) / 2;
        const midY = Math.min(senderPos.y, targetPos.y) - 40;

        setStyle({
          '--start-x': `${senderPos.x}px`,
          '--start-y': `${senderPos.y}px`,
          '--mid-x': `${midX}px`,
          '--mid-y': `${midY}px`,
          '--end-x': `${targetPos.x}px`,
          '--end-y': `${targetPos.y}px`,
        } as React.CSSProperties);

        // Trigger target pulse after dot arrives
        setTimeout(() => setTargetPulse(targetPos), 700);

        return () => clearTimeout(cleanupTimer);
      }
    }

    // Fallback: no sender visible — just pulse the target
    setTargetPulse(targetPos);
    return () => clearTimeout(cleanupTimer);
  }, [animation]);

  return (
    <>
      {style && (
        <div className="promptFlyingDot" style={style} />
      )}
      {targetPulse && (
        <div
          className="promptTargetPulse"
          style={{
            left: targetPulse.x,
            top: targetPulse.y,
          }}
        />
      )}
    </>
  );
}
