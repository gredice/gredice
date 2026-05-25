'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react';
import { SortableDragHandle } from '../../../../components/admin/directories/SortableDragHandle';

type CmsPageSortablePreviewSectionProps = {
    id: string;
    selected: boolean;
    children: ReactNode;
    badge?: ReactNode;
    className?: string;
    onSelect: () => void;
};

export function CmsPageSortablePreviewSection({
    id,
    selected,
    children,
    badge,
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
        transform: CSS.Translate.toString(transform),
        transition,
    };
    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (
            event.defaultPrevented ||
            (event.key !== 'Enter' && event.key !== ' ')
        ) {
            return;
        }

        event.preventDefault();
        onSelect();
    };

    return (
        <div
            className={`group/section flex items-start gap-2 ${isDragging ? 'opacity-70' : ''}`}
            ref={setNodeRef}
            style={style}
        >
            <SortableDragHandle
                {...attributes}
                {...listeners}
                aria-label="Promijeni poredak sekcije"
                title="Promijeni poredak sekcije"
                size="compact"
                className={
                    isDragging
                        ? 'cursor-grabbing bg-muted text-foreground'
                        : 'md:opacity-0 md:transition-opacity md:group-hover/section:opacity-100 md:group-focus-within/section:opacity-100 md:focus-visible:opacity-100'
                }
            />
            {/* biome-ignore lint/a11y/useSemanticElements: CMS preview sections can contain buttons and links, so the selectable wrapper cannot be a native button. */}
            <div
                aria-pressed={selected}
                className={`relative min-w-0 flex-1 cursor-pointer overflow-visible rounded-lg outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                    className ?? ''
                }`}
                onClick={onSelect}
                onKeyDown={handleKeyDown}
                role="button"
                tabIndex={0}
            >
                <span
                    aria-hidden="true"
                    className={`pointer-events-none absolute -left-2 top-2 bottom-2 w-0.5 rounded-full transition-opacity ${
                        selected
                            ? 'bg-primary/45 opacity-100'
                            : 'bg-primary/25 opacity-0 group-hover/section:opacity-100 group-focus-within/section:opacity-100'
                    }`}
                />
                {badge && (
                    <div className="pointer-events-none absolute right-2 top-2 z-10 inline-flex items-center text-[11px] font-medium text-muted-foreground">
                        {badge}
                    </div>
                )}
                {children}
            </div>
        </div>
    );
}
