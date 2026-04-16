'use client';

import {
    closestCenter,
    DndContext,
    type DragEndEvent,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type {
    ExtendedAttributeDefinition,
    SelectAttributeDefinitionCategory,
} from '@gredice/storage';
import { SplitView } from '@signalco/ui/SplitView';
import {
    Binary,
    BookA,
    Bookmark,
    File,
    FontType,
    Hash,
    Tally3,
    ToggleRight,
} from '@signalco/ui-icons';
import { Card } from '@signalco/ui-primitives/Card';
import { Chip } from '@signalco/ui-primitives/Chip';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import Link from 'next/link';
import type { CSSProperties, HTMLAttributes, MouseEvent } from 'react';
import { useEffect, useState } from 'react';
import {
    reorderAttributeDefinition,
    reorderAttributeDefinitionCategory,
} from '../../../app/(actions)/definitionActions';
import { KnownPages } from '../../../src/KnownPages';
import { NoDataPlaceholder } from '../../shared/placeholders/NoDataPlaceholder';
import { CreateAttributeDefinitionButton } from '../buttons/CreateAttributeDefinitionButton';
import { CreateAttributeDefinitionCategoryButton } from '../buttons/CreateAttributeDefinitionCategoryButton';
import { TableAttributeOrderSection } from './TableAttributeOrderSection';

function AttributeDataTypeIcon({
    dataType,
    ...rest
}: { dataType: string } & HTMLAttributes<SVGElement>) {
    if (dataType.startsWith('ref:')) {
        return <File {...rest} />;
    }
    switch (dataType) {
        case 'text':
            return <FontType {...rest} />;
        case 'number':
            return <Hash {...rest} />;
        case 'boolean':
            return <ToggleRight {...rest} />;
        case 'barcode':
            return <Tally3 {...rest} />;
        case 'markdown':
            return (
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    {...rest}
                >
                    <title>Markdown</title>
                    <path d="M2 16V8l4 4 4-4v8" />
                    <path d="M18 8v8" />
                    <path d="m22 12-4 4-4-4" />
                </svg>
            );
        default:
            return <Binary {...rest} />;
    }
}

function AttributeDefinitionCard({
    attributeDefinition,
    isDragging = false,
}: {
    attributeDefinition: ExtendedAttributeDefinition;
    isDragging?: boolean;
}) {
    const handleClick = (e: MouseEvent) => {
        if (isDragging) {
            e.preventDefault();
            e.stopPropagation();
        }
    };

    return (
        <Link
            href={KnownPages.DirectoryEntityTypeAttributeDefinition(
                attributeDefinition.entityTypeName,
                attributeDefinition.id,
            )}
            onClick={handleClick}
        >
            <Card>
                <Row spacing={1}>
                    <AttributeDataTypeIcon
                        dataType={attributeDefinition.dataType}
                        className="size-5 text-muted-foreground"
                    />
                    <Stack>
                        <Row spacing={1}>
                            <Typography level="body1">
                                {attributeDefinition.label}
                                {attributeDefinition.required && (
                                    <span className="text-red-600/60 ml-1">
                                        *
                                    </span>
                                )}
                            </Typography>
                            {attributeDefinition.display && (
                                <Chip color="info">Prikaz</Chip>
                            )}
                        </Row>
                        <Typography level="body3" className="line-clamp-2">
                            {attributeDefinition.description}
                        </Typography>
                    </Stack>
                </Row>
            </Card>
        </Link>
    );
}

function AttributeDefinitionCategoryCard({
    attributeDefinitionCategory,
    isDragging = false,
}: {
    attributeDefinitionCategory: SelectAttributeDefinitionCategory;
    isDragging?: boolean;
}) {
    const handleClick = (e: MouseEvent) => {
        if (isDragging) {
            e.preventDefault();
            e.stopPropagation();
        }
    };

    return (
        <Link
            href={KnownPages.DirectoryEntityTypeAttributeDefinitionCategory(
                attributeDefinitionCategory.entityTypeName,
                attributeDefinitionCategory.id,
            )}
            onClick={handleClick}
        >
            <Card>
                <Row spacing={1} justifyContent="space-between">
                    <Stack>
                        <Typography level="body2">
                            {attributeDefinitionCategory.label}
                        </Typography>
                    </Stack>
                </Row>
            </Card>
        </Link>
    );
}

function SortableCategory({
    category,
    preventClick,
}: {
    category: SelectAttributeDefinitionCategory;
    preventClick: boolean;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: category.id.toString() });
    const style: CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
    };
    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            <AttributeDefinitionCategoryCard
                attributeDefinitionCategory={category}
                isDragging={isDragging || preventClick}
            />
        </div>
    );
}

function SortableAttributeDefinition({
    attribute,
    preventClick,
}: {
    attribute: ExtendedAttributeDefinition;
    preventClick: boolean;
}) {
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
    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            <AttributeDefinitionCard
                attributeDefinition={attribute}
                isDragging={isDragging || preventClick}
            />
        </div>
    );
}

function CategorySection({
    category,
    initialDefinitions,
    entityTypeName,
}: {
    category: SelectAttributeDefinitionCategory;
    initialDefinitions: ExtendedAttributeDefinition[];
    entityTypeName: string;
}) {
    const [items, setItems] = useState(initialDefinitions);
    const [preventClick, setPreventClick] = useState(false);
    const sensors = useSensors(useSensor(PointerSensor));

    useEffect(() => {
        if (!preventClick) return;
        const timeout = setTimeout(() => {
            setPreventClick(false);
        }, 200);
        return () => clearTimeout(timeout);
    }, [preventClick]);

    async function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const oldIndex = items.findIndex((i) => i.id.toString() === active.id);
        const newIndex = items.findIndex((i) => i.id.toString() === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex);
        setItems(newItems);
        setPreventClick(true);
        const prev = newItems[newIndex - 1]?.order ?? null;
        const next = newItems[newIndex + 1]?.order ?? null;
        await reorderAttributeDefinition(
            entityTypeName,
            Number(active.id),
            prev,
            next,
        );
    }

    return (
        <Stack spacing={1} key={category.id}>
            <Row spacing={1} justifyContent="space-between">
                <Row spacing={1}>
                    <BookA className="size-5 text-tertiary-foreground" />
                    <Typography level="body2" className="">
                        {category.label}
                    </Typography>
                </Row>
                <CreateAttributeDefinitionButton
                    entityTypeName={entityTypeName}
                    categoryName={category.name}
                />
            </Row>
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <SortableContext
                    items={items.map((i) => i.id.toString())}
                    strategy={verticalListSortingStrategy}
                >
                    {items.map((attribute) => (
                        <SortableAttributeDefinition
                            key={attribute.id}
                            attribute={attribute}
                            preventClick={preventClick}
                        />
                    ))}
                </SortableContext>
            </DndContext>
        </Stack>
    );
}

export function AttributeDefinitionsListClient({
    entityTypeName,
    attributeDefinitionCategories,
    attributeDefinitions,
}: {
    entityTypeName: string;
    attributeDefinitionCategories: SelectAttributeDefinitionCategory[];
    attributeDefinitions: ExtendedAttributeDefinition[];
}) {
    const [categories, setCategories] = useState(attributeDefinitionCategories);
    const [preventCategoryClick, setPreventCategoryClick] = useState(false);
    const sensors = useSensors(useSensor(PointerSensor));

    useEffect(() => {
        if (!preventCategoryClick) return;
        const timeout = setTimeout(() => {
            setPreventCategoryClick(false);
        }, 200);
        return () => clearTimeout(timeout);
    }, [preventCategoryClick]);

    async function handleCategoryDragEnd(event: DragEndEvent) {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const oldIndex = categories.findIndex(
            (c) => c.id.toString() === active.id,
        );
        const newIndex = categories.findIndex(
            (c) => c.id.toString() === over.id,
        );
        const newItems = arrayMove(categories, oldIndex, newIndex);
        setCategories(newItems);
        setPreventCategoryClick(true);
        const prev = newItems[newIndex - 1]?.order ?? null;
        const next = newItems[newIndex + 1]?.order ?? null;
        await reorderAttributeDefinitionCategory(
            entityTypeName,
            Number(active.id),
            prev,
            next,
        );
    }

    return (
        <SplitView minSize={220}>
            <Stack spacing={2} className="mr-4">
                <Row spacing={1} justifyContent="space-between">
                    <Row spacing={1}>
                        <Bookmark className="size-5 text-tertiary-foreground" />
                        <Typography level="body2" className="">
                            Kategorije
                        </Typography>
                    </Row>
                    <CreateAttributeDefinitionCategoryButton
                        entityTypeName={entityTypeName}
                    />
                </Row>
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleCategoryDragEnd}
                >
                    <SortableContext
                        items={categories.map((c) => c.id.toString())}
                        strategy={verticalListSortingStrategy}
                    >
                        <Stack spacing={1}>
                            {categories.length <= 0 && <NoDataPlaceholder />}
                            {categories.map((c) => (
                                <SortableCategory
                                    key={c.id}
                                    category={c}
                                    preventClick={preventCategoryClick}
                                />
                            ))}
                        </Stack>
                    </SortableContext>
                </DndContext>
            </Stack>
            <Stack spacing={2} className="ml-4">
                <TableAttributeOrderSection
                    entityTypeName={entityTypeName}
                    attributeDefinitions={attributeDefinitions}
                />
                {categories.length <= 0 && <NoDataPlaceholder />}
                {categories.map((category) => (
                    <CategorySection
                        key={category.id}
                        category={category}
                        initialDefinitions={attributeDefinitions.filter(
                            (a) => a.category === category.name,
                        )}
                        entityTypeName={entityTypeName}
                    />
                ))}
            </Stack>
        </SplitView>
    );
}
