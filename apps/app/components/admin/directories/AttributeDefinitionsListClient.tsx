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
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import Link from 'next/link';
import type { CSSProperties, HTMLAttributes } from 'react';
import { useState } from 'react';
import {
    reorderAttributeDefinition,
    reorderAttributeDefinitionCategory,
} from '../../../app/(actions)/definitionActions';
import { KnownPages } from '../../../src/KnownPages';
import { NoDataPlaceholder } from '../../shared/placeholders/NoDataPlaceholder';
import { CreateAttributeDefinitionButton } from '../buttons/CreateAttributeDefinitionButton';
import { CreateAttributeDefinitionCategoryButton } from '../buttons/CreateAttributeDefinitionCategoryButton';

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
}: {
    attributeDefinition: ExtendedAttributeDefinition;
}) {
    return (
        <Link
            href={KnownPages.DirectoryEntityTypeAttributeDefinition(
                attributeDefinition.entityTypeName,
                attributeDefinition.id,
            )}
        >
            <Card>
                <Row spacing={1}>
                    <AttributeDataTypeIcon
                        dataType={attributeDefinition.dataType}
                        className="size-5 text-muted-foreground"
                    />
                    <Stack>
                        <Typography level="body1">
                            {attributeDefinition.label}
                            {attributeDefinition.required && (
                                <span className="text-red-600/60 ml-1">*</span>
                            )}
                        </Typography>
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
}: {
    attributeDefinitionCategory: SelectAttributeDefinitionCategory;
}) {
    return (
        <Link
            href={KnownPages.DirectoryEntityTypeAttributeDefinitionCategory(
                attributeDefinitionCategory.entityTypeName,
                attributeDefinitionCategory.id,
            )}
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
}: {
    category: SelectAttributeDefinitionCategory;
}) {
    const { attributes, listeners, setNodeRef, transform, transition } =
        useSortable({ id: category.id.toString() });
    const style: CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
    };
    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            <AttributeDefinitionCategoryCard
                attributeDefinitionCategory={category}
            />
        </div>
    );
}

function SortableAttributeDefinition({
    attribute,
}: {
    attribute: ExtendedAttributeDefinition;
}) {
    const { attributes, listeners, setNodeRef, transform, transition } =
        useSortable({ id: attribute.id.toString() });
    const style: CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
    };
    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            <AttributeDefinitionCard attributeDefinition={attribute} />
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
    const sensors = useSensors(useSensor(PointerSensor));

    async function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const oldIndex = items.findIndex((i) => i.id.toString() === active.id);
        const newIndex = items.findIndex((i) => i.id.toString() === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex);
        setItems(newItems);
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
    const sensors = useSensors(useSensor(PointerSensor));

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
                                <SortableCategory key={c.id} category={c} />
                            ))}
                        </Stack>
                    </SortableContext>
                </DndContext>
            </Stack>
            <Stack spacing={2} className="ml-4">
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
