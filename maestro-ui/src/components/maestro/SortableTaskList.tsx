import React, { useCallback, useMemo } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TaskTreeNode } from "../../app/types/maestro";

// Phase 2: Module-scope constant
const PERMANENT_DELETE_OPTIONS = { showPermanentDelete: true } as const;

type SortableTaskItemProps = {
  id: string;
  children: React.ReactNode;
};

const SortableTaskItem = React.memo(function SortableTaskItem({ id, children }: SortableTaskItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = useMemo<React.CSSProperties>(() => ({
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    cursor: isDragging ? "grabbing" : undefined,
    willChange: isDragging ? "transform" : "auto",
  }), [transform, transition, isDragging]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`sortableItemWrapper ${isDragging ? "sortableItemWrapper--dragging" : ""}`}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
});

type SortableTaskListProps = {
  roots: TaskTreeNode[];
  renderTaskNode: (
    node: TaskTreeNode,
    depth: number,
    options?: { showPermanentDelete?: boolean }
  ) => React.ReactNode;
  onReorder: (orderedIds: string[]) => void;
  showPermanentDelete?: boolean;
  listClassName?: string;
};

export function SortableTaskList({
  roots,
  renderTaskNode,
  onReorder,
  showPermanentDelete,
  listClassName,
}: SortableTaskListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 300,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Presentational partition of the (already manually-ordered) roots into the
  // two design sections — "In progress" (in_progress) and "Up next" (the rest).
  // Read-only: order within each slice is preserved verbatim, no status mutation.
  const inProgress = useMemo(() => roots.filter((r) => r.status === "in_progress"), [roots]);
  const upNext = useMemo(() => roots.filter((r) => r.status !== "in_progress"), [roots]);
  // Single sortable list over the flat display order (in_progress-first); the two
  // section headers are interspersed render-only and are not sortable items.
  const displayRoots = useMemo(() => [...inProgress, ...upNext], [inProgress, upNext]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = displayRoots.findIndex((r) => r.id === active.id);
      const newIndex = displayRoots.findIndex((r) => r.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const newOrder = arrayMove(
        displayRoots.map((r) => r.id),
        oldIndex,
        newIndex
      );
      onReorder(newOrder);
    },
    [displayRoots, onReorder]
  );

  const ids = useMemo(() => displayRoots.map((r) => r.id), [displayRoots]);

  const renderItem = (node: TaskTreeNode) => (
    <SortableTaskItem key={node.id} id={node.id}>
      {renderTaskNode(node, 0, showPermanentDelete ? PERMANENT_DELETE_OPTIONS : undefined)}
    </SortableTaskItem>
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className={listClassName || undefined}>
          {inProgress.length > 0 && (
            <>
              <div className="pn-sec-head">
                <span className="pn-eyebrow">In progress <span className="pn-count">· {inProgress.length}</span></span>
                <span className="pn-line" />
              </div>
              <div className="pn-list">{inProgress.map(renderItem)}</div>
            </>
          )}
          {upNext.length > 0 && (
            <>
              <div className="pn-sec-head">
                <span className="pn-eyebrow">Up next <span className="pn-count">· {upNext.length}</span></span>
                <span className="pn-line" />
              </div>
              <div className="pn-list">{upNext.map(renderItem)}</div>
            </>
          )}
        </div>
      </SortableContext>
    </DndContext>
  );
}
