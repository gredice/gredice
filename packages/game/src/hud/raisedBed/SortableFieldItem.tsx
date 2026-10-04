import {
    type AnimateLayoutChanges,
    defaultAnimateLayoutChanges,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cx } from '@gredice/ui/utils';
import type { CSSProperties, ReactNode } from 'react';
import { DragGripIndicator } from './DragHandle';

export function SortableFieldItem({
    id,
    disabled,
    dropAnimationDisabled,
    showHandle,
    children,
}: {
    id: string;
    disabled: boolean;
    dropAnimationDisabled?: boolean;
    showHandle: boolean;
    children: (props: { isDragging: boolean }) => ReactNode;
}) {
    const animateLayoutChanges: AnimateLayoutChanges = (args) => {
        if (dropAnimationDisabled && args.wasDragging && !args.isSorting) {
            return false;
        }

        return defaultAnimateLayoutChanges(args);
    };
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
        animateLayoutChanges,
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
