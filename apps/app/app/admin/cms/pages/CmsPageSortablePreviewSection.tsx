'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card } from '@gredice/ui/Card';
import { Row } from '@gredice/ui/Row';
import type { CSSProperties, ReactNode } from 'react';
import { SortableDragHandle } from '../../../../components/admin/directories/SortableDragHandle';

type CmsPageSortablePreviewSectionProps = {
    id: string;
    selected: boolean;
    children: ReactNode;
    className?: string;
    onSelect: () => void;
};

export function CmsPageSortablePreviewSection({
    id,
    selected,
    children,
    className,
    onSelect,
}: CmsPageSortablePreviewSectionProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id });
    const style: CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <Row
            spacing={2}
            className={`items-stretch ${isDragging ? 'opacity-70' : ''}`}
            ref={setNodeRef}
            style={style}
        >
            <SortableDragHandle
                {...attributes}
                {...listeners}
                aria-label="Promijeni poredak sekcije"
                title="Promijeni poredak sekcije"
                className={
                    isDragging ? 'cursor-grabbing bg-muted text-foreground' : ''
                }
            />
            <Card
                className={`min-w-0 flex-1 cursor-pointer overflow-hidden p-3 ${
                    selected ? 'border-primary' : ''
                } ${className ?? ''}`}
                onClick={onSelect}
            >
                {children}
            </Card>
        </Row>
    );
}
