'use client';

import {
    closestCenter,
    DndContext,
    type DragEndEvent,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ExtendedAttributeDefinition } from '@gredice/storage';
import { Card } from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { Tablet } from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import Link from 'next/link';
import type { CSSProperties, MouseEvent } from 'react';
import { useEffect, useState } from 'react';
import { reorderAttributeDefinition } from '../../../app/(actions)/definitionActions';
import { KnownPages } from '../../../src/KnownPages';
import { SortableDragHandle } from './SortableDragHandle';

function SortableTableAttributeRow({
    attribute,
    preventClick,
}: {
    attribute: ExtendedAttributeDefinition;
    preventClick: boolean;
}) {
    const categoryLabel =
        attribute.categoryDefinition?.label ?? attribute.category;
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: attribute.id.toString() });

    const style: CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const handleClick = (e: MouseEvent) => {
        if (isDragging || preventClick) {
            e.preventDefault();
            e.stopPropagation();
        }
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="flex items-stretch gap-1"
        >
            <SortableDragHandle
                {...attributes}
                {...listeners}
                aria-label="Promijeni poredak atributa u tablici"
                title="Promijeni poredak atributa u tablici"
                className={
                    isDragging ? 'cursor-grabbing bg-muted text-foreground' : ''
                }
            />
            <Link
                href={KnownPages.DirectoryEntityTypeAttributeDefinition(
                    attribute.entityTypeName,
                    attribute.id,
                )}
                onClick={handleClick}
                className="min-w-0 flex-1"
            >
                <Card>
                    <Row spacing={2} justifyContent="space-between">
                        <Typography level="body2">{attribute.label}</Typography>
                        {categoryLabel ? <Chip>{categoryLabel}</Chip> : null}
                    </Row>
                </Card>
            </Link>
        </div>
    );
}

export function TableAttributeOrderSection({
    entityTypeName,
    attributeDefinitions,
}: {
    entityTypeName: string;
    attributeDefinitions: ExtendedAttributeDefinition[];
}) {
    const [displayAttributes, setDisplayAttributes] = useState(
        attributeDefinitions.filter((attribute) => attribute.display),
    );
    const [preventClick, setPreventClick] = useState(false);
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        }),
    );

    useEffect(() => {
        setDisplayAttributes(
            attributeDefinitions.filter((attribute) => attribute.display),
        );
    }, [attributeDefinitions]);

    useEffect(() => {
        if (!preventClick) return;
        const timeout = setTimeout(() => {
            setPreventClick(false);
        }, 200);
        return () => clearTimeout(timeout);
    }, [preventClick]);

    async function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;
        setPreventClick(true);
        if (!over || active.id === over.id) return;

        const oldIndex = displayAttributes.findIndex(
            (attribute) => attribute.id.toString() === active.id,
        );
        const newIndex = displayAttributes.findIndex(
            (attribute) => attribute.id.toString() === over.id,
        );

        const newItems = arrayMove(displayAttributes, oldIndex, newIndex);
        setDisplayAttributes(newItems);

        const prev = newItems[newIndex - 1]?.order ?? null;
        const next = newItems[newIndex + 1]?.order ?? null;

        await reorderAttributeDefinition(
            entityTypeName,
            Number(active.id),
            prev,
            next,
        );
    }

    if (displayAttributes.length <= 0) {
        return null;
    }

    return (
        <Stack spacing={2}>
            <Row spacing={2}>
                <Tablet className="size-5 text-tertiary-foreground" />
                <Typography level="body2">
                    Poredak atributa u tablici
                </Typography>
            </Row>
            <DndContext
                id={`table-attribute-order-${entityTypeName}`}
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={() => setPreventClick(true)}
                onDragCancel={() => setPreventClick(true)}
                onDragEnd={handleDragEnd}
            >
                <SortableContext
                    items={displayAttributes.map((attribute) =>
                        attribute.id.toString(),
                    )}
                    strategy={verticalListSortingStrategy}
                >
                    <Stack spacing={2}>
                        {displayAttributes.map((attribute) => (
                            <SortableTableAttributeRow
                                key={attribute.id}
                                attribute={attribute}
                                preventClick={preventClick}
                            />
                        ))}
                    </Stack>
                </SortableContext>
            </DndContext>
        </Stack>
    );
}
