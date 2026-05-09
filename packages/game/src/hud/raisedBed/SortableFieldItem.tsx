import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cx } from '@signalco/ui-primitives/cx';
import type { CSSProperties, ReactNode } from 'react';
import { DragGripIndicator } from './DragHandle';

export function SortableFieldItem({
    id,
    disabled,
    showHandle,
    children,
}: {
    id: string;
    disabled: boolean;
    showHandle: boolean;
    children: (props: { isDragging: boolean }) => ReactNode;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id,
        disabled,
    });

    const isDraggable = showHandle && !disabled;

    const style: CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : undefined,
        position: 'relative',
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cx(
                'size-full',
                isDraggable && 'touch-none cursor-grab',
                isDragging && 'cursor-grabbing',
            )}
            {...(isDraggable ? listeners : undefined)}
            {...(isDraggable ? attributes : undefined)}
        >
            {children({ isDragging })}
            {isDraggable && <DragGripIndicator />}
        </div>
    );
}
