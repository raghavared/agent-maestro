import React, { useCallback } from "react";
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

type SortableTaskItemProps = {
  id: string;
  children: React.ReactNode;
};

function SortableTaskItem({ id, children }: SortableTaskItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    cursor: isDragging ? "grabbing" : undefined,
  };

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
}

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

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = roots.findIndex((r) => r.id === active.id);
      const newIndex = roots.findIndex((r) => r.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const newOrder = arrayMove(
        roots.map((r) => r.id),
        oldIndex,
        newIndex
      );
      onReorder(newOrder);
    },
    [roots, onReorder]
  );

  const ids = roots.map((r) => r.id);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className={`terminalTaskList ${listClassName || ""}`}>
          <div className="terminalTaskHeader">
            <span>STATUS</span>
            <span>TASK</span>
            <span>AGENT</span>
            <span>ACTIONS</span>
          </div>
          {roots.map((node) => (
            <SortableTaskItem key={node.id} id={node.id}>
              {renderTaskNode(
                node,
                0,
                showPermanentDelete
                  ? { showPermanentDelete: true }
                  : undefined
              )}
            </SortableTaskItem>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
