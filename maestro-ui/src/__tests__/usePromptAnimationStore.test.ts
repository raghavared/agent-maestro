import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  usePromptAnimationStore,
  selectPromptSurface,
} from '../stores/usePromptAnimationStore';

const reset = () => usePromptAnimationStore.setState({ animations: [] });

describe('selectPromptSurface', () => {
  it('returns bar when sender and target projects differ', () => {
    expect(selectPromptSurface('projA', 'projB', true)).toBe('bar');
    expect(selectPromptSurface('projA', 'projB', false)).toBe('bar');
  });

  it('returns rail for same project when the rail is visible', () => {
    expect(selectPromptSurface('projA', 'projA', true)).toBe('rail');
  });

  it('returns tree for same project when the rail is not visible', () => {
    expect(selectPromptSurface('projA', 'projA', false)).toBe('tree');
  });

  it('falls back to rail/tree when a project id is missing', () => {
    expect(selectPromptSurface(null, null, true)).toBe('rail');
    expect(selectPromptSurface('projA', null, false)).toBe('tree');
    expect(selectPromptSurface(undefined, 'projB', true)).toBe('rail');
  });
});

describe('usePromptAnimationStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    reset();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    reset();
  });

  it('adds an animation with a generated id and timestamp', () => {
    usePromptAnimationStore.getState().addAnimation({
      surface: 'rail',
      senderMaestroSessionId: 'a',
      targetMaestroSessionId: 'b',
      content: 'hi',
    });
    const anims = usePromptAnimationStore.getState().animations;
    expect(anims).toHaveLength(1);
    expect(anims[0].id).toMatch(/^prompt-anim-/);
    expect(anims[0].timestamp).toBeGreaterThan(0);
    expect(anims[0].surface).toBe('rail');
  });

  it('auto-removes an animation after 1500ms', () => {
    usePromptAnimationStore.getState().addAnimation({
      surface: 'tree',
      senderMaestroSessionId: 'a',
      targetMaestroSessionId: 'b',
      content: 'hi',
    });
    expect(usePromptAnimationStore.getState().animations).toHaveLength(1);

    vi.advanceTimersByTime(1499);
    expect(usePromptAnimationStore.getState().animations).toHaveLength(1);

    vi.advanceTimersByTime(1);
    expect(usePromptAnimationStore.getState().animations).toHaveLength(0);
  });

  it('removeAnimation drops a specific animation', () => {
    const add = usePromptAnimationStore.getState().addAnimation;
    add({ surface: 'bar', senderMaestroSessionId: 'a', targetMaestroSessionId: 'b', content: '1' });
    add({ surface: 'bar', senderMaestroSessionId: 'c', targetMaestroSessionId: 'd', content: '2' });
    const [first] = usePromptAnimationStore.getState().animations;
    usePromptAnimationStore.getState().removeAnimation(first.id);
    const remaining = usePromptAnimationStore.getState().animations;
    expect(remaining).toHaveLength(1);
    expect(remaining.find((a) => a.id === first.id)).toBeUndefined();
  });

  it('caps concurrent animations at 6, dropping the oldest', () => {
    const add = usePromptAnimationStore.getState().addAnimation;
    for (let i = 0; i < 10; i++) {
      add({
        surface: 'rail',
        senderMaestroSessionId: `s${i}`,
        targetMaestroSessionId: `t${i}`,
        content: `${i}`,
      });
    }
    const anims = usePromptAnimationStore.getState().animations;
    expect(anims).toHaveLength(6);
    // Oldest (content "0".."3") dropped; newest retained.
    expect(anims[0].content).toBe('4');
    expect(anims[anims.length - 1].content).toBe('9');
  });
});
