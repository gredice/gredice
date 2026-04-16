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
import { Tablet } from '@signalco/ui-icons';
import { Card } from '@signalco/ui-primitives/Card';
import { Chip } from '@signalco/ui-primitives/Chip';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import Link from 'next/link';
import type { CSSProperties, MouseEvent } from 'react';
import { useEffect, useState } from 'react';
import { reorderAttributeDefinition } from '../../../app/(actions)/definitionActions';
import { KnownPages } from '../../../src/KnownPages';

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
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            <Link
                href={KnownPages.DirectoryEntityTypeAttributeDefinition(
                    attribute.entityTypeName,
                    attribute.id,
                )}
                onClick={handleClick}
            >
                <Card>
                    <Row spacing={1} justifyContent="space-between">
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
        <Stack spacing={1}>
            <Row spacing={1}>
                <Tablet className="size-5 text-tertiary-foreground" />
                <Typography level="body2">
                    Poredak atributa u tablici
                </Typography>
            </Row>
            <DndContext
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
                    <Stack spacing={1}>
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
