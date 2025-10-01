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
import type { SelectEntityType } from '@gredice/storage';
import { AuthProtectedSection } from '@signalco/auth-client/components';
import {
    Add,
    Bank,
    Book,
    Calendar,
    Edit,
    Euro,
    Fence,
    File,
    Hammer,
    Home,
    Inbox,
    Megaphone,
    ShoppingCart,
    SmileHappy,
    Tally3,
    Truck,
    User,
} from '@signalco/ui-icons';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { List, ListHeader } from '@signalco/ui-primitives/List';
import { ListTreeItem } from '@signalco/ui-primitives/ListTreeItem';
import { Stack } from '@signalco/ui-primitives/Stack';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import { useContext, useState } from 'react';
import { reorderEntityType } from '../../../app/(actions)/entityActions';
import { KnownPages } from '../../../src/KnownPages';
import { NavContext } from './NavContext';
import { NavItem } from './NavItem';
import { ProfileNavItem } from './ProfileNavItem';

function SortableNavItem({
    entityType,
    onClick,
}: {
    entityType: SelectEntityType;
    onClick?: () => void;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: entityType.id.toString() });
    const style: CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
    };
    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            <NavItem
                href={KnownPages.DirectoryEntityType(entityType.name)}
                label={entityType.label}
                icon={<File className="size-5" />}
                onClick={onClick}
                isDragging={isDragging}
            />
        </div>
    );
}

function EntityTypeList({
    items: initialItems,
    onItemClick,
}: {
    items: SelectEntityType[];
    onItemClick?: () => void;
}) {
    const [items, setItems] = useState(initialItems);
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
        await reorderEntityType(Number(active.id), prev, next);
    }

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
        >
            <SortableContext
                items={items.map((i) => i.id.toString())}
                strategy={verticalListSortingStrategy}
            >
                <List>
                    {items.map((entityType) => (
                        <SortableNavItem
                            key={entityType.id}
                            entityType={entityType}
                            onClick={onItemClick}
                        />
                    ))}
                </List>
            </SortableContext>
        </DndContext>
    );
}

export function Nav({ onItemClick }: { onItemClick?: () => void } = {}) {
    const categorizedTypes = useContext(NavContext)?.categorizedTypes || [];
    const uncategorizedTypes = useContext(NavContext)?.uncategorizedTypes || [];
    const shadowTypes = useContext(NavContext)?.shadowTypes || [];

    return (
        <Stack spacing={2}>
            <List>
                <ProfileNavItem onItemClick={onItemClick} />
                <NavItem
                    href={KnownPages.Dashboard}
                    label="Početna"
                    icon={<Home className="size-5" />}
                    strictMatch
                    onClick={onItemClick}
                />
            </List>
            <Stack spacing={1}>
                <AuthProtectedSection>
                    {/* Categories with their entity types */}
                    {categorizedTypes.map((category) => (
                        <Stack key={category.id} spacing={1}>
                            <ListHeader
                                header={category.label}
                                actions={[
                                    <Link
                                        key={`edit-${category.id}`}
                                        href={KnownPages.DirectoryCategoryEdit(
                                            category.id,
                                        )}
                                    >
                                        <IconButton
                                            title="Uredi kategoriju"
                                            variant="plain"
                                        >
                                            <Edit className="size-4" />
                                        </IconButton>
                                    </Link>,
                                ]}
                            />
                            <EntityTypeList
                                items={category.entityTypes}
                                onItemClick={onItemClick}
                            />
                        </Stack>
                    ))}
                </AuthProtectedSection>

                <ListHeader
                    header="Zapisi"
                    actions={[
                        <Link
                            key="category-create"
                            href={KnownPages.DirectoryCategoryCreate}
                        >
                            <IconButton
                                title="Dodaj novu kategoriju"
                                variant="plain"
                            >
                                <div className="size-4 shrink-0 relative">
                                    <Book className="size-4 shrink-0 opacity-60" />
                                    <Add className="absolute inset-0 size-3 left-0.5" />
                                </div>
                            </IconButton>
                        </Link>,
                        <Link
                            key="entity-type-create"
                            href={KnownPages.DirectoryEntityTypeCreate}
                        >
                            <IconButton
                                title="Dodaj novi tip zapisa"
                                variant="plain"
                            >
                                <Add className="size-4 shrink-0" />
                            </IconButton>
                        </Link>,
                    ]}
                />
                <AuthProtectedSection>
                    {/* Shadow entity types */}
                    {shadowTypes.length > 0 && (
                        <ListTreeItem label="Ostalo">
                            {shadowTypes.map((entityType) => (
                                <NavItem
                                    key={entityType.id}
                                    href={KnownPages.DirectoryEntityType(
                                        entityType.name,
                                    )}
                                    label={entityType.label}
                                    icon={<File className="size-5" />}
                                    onClick={onItemClick}
                                />
                            ))}
                        </ListTreeItem>
                    )}

                    {/* Entity types without category come first */}
                    {uncategorizedTypes.length > 0 && (
                        <EntityTypeList
                            items={uncategorizedTypes}
                            onItemClick={onItemClick}
                        />
                    )}
                </AuthProtectedSection>
            </Stack>
            <Stack spacing={1}>
                <ListHeader header="Administracija" />
                <List>
                    <NavItem
                        href={KnownPages.Accounts}
                        label="Korisnički računi"
                        icon={<Bank className="size-5" />}
                        onClick={onItemClick}
                    />
                    <NavItem
                        href={KnownPages.ShoppingCarts}
                        label="Košarice"
                        icon={<ShoppingCart className="size-5" />}
                        onClick={onItemClick}
                    />
                    <NavItem
                        href={KnownPages.Invoices}
                        label="Ponude"
                        icon={<File className="size-5" />}
                        onClick={onItemClick}
                    />
                    <NavItem
                        href={KnownPages.Transactions}
                        label="Transakcije"
                        icon={<Euro className="size-5" />}
                        onClick={onItemClick}
                    />
                    <NavItem
                        href={KnownPages.Receipts}
                        label="Fiskalni računi"
                        icon={<File className="size-5" />}
                        onClick={onItemClick}
                    />
                    <NavItem
                        href={KnownPages.Users}
                        label="Korisnici"
                        icon={<User className="size-5" />}
                        onClick={onItemClick}
                    />
                    <NavItem
                        href={KnownPages.Gardens}
                        label="Vrtovi"
                        icon={<Fence className="size-5" />}
                        onClick={onItemClick}
                    />
                    <NavItem
                        href={KnownPages.RaisedBeds}
                        label="Gredice"
                        icon={<Tally3 className="size-5 rotate-90 mt-1" />}
                        onClick={onItemClick}
                    />
                    <NavItem
                        href={KnownPages.Operations}
                        label="Radnje"
                        icon={<Hammer className="size-5" />}
                        onClick={onItemClick}
                    />
                </List>
            </Stack>
            <Stack spacing={1}>
                <ListHeader header="Upravljanje" />
                <List>
                    <NavItem
                        href={KnownPages.Schedule}
                        label="Raspored"
                        icon={<Calendar className="size-5" />}
                        onClick={onItemClick}
                    />
                    <NavItem
                        href={KnownPages.DeliverySlots}
                        label="Dostava - Slotovi"
                        icon={<Truck className="size-5" />}
                        onClick={onItemClick}
                    />
                    <NavItem
                        href={KnownPages.DeliveryRequests}
                        label="Dostava - Zahtjevi"
                        icon={<Truck className="size-5" />}
                        onClick={onItemClick}
                    />
                </List>
            </Stack>
            <Stack spacing={1}>
                <ListHeader header="Komunikacija" />
                <List>
                    <NavItem
                        href={KnownPages.CommunicationInbox}
                        label="Sandučić"
                        icon={<Inbox className="size-5" />}
                        onClick={onItemClick}
                    />
                    <NavItem
                        href={KnownPages.CommunicationNewsletter}
                        label="Newsletter"
                        icon={<Megaphone className="size-5" />}
                        onClick={onItemClick}
                    />
                    <NavItem
                        href={KnownPages.Feedback}
                        label="Povratne informacije"
                        icon={<SmileHappy className="size-5" />}
                        onClick={onItemClick}
                    />
                </List>
            </Stack>
            <Stack spacing={1}>
                <ListHeader header="Sustavi" />
                <List>
                    <NavItem
                        href={KnownPages.Sensors}
                        label="Senzori"
                        icon={<File className="size-5" />}
                        onClick={onItemClick}
                    />
                    <NavItem
                        href={KnownPages.Cache}
                        label="Cache"
                        icon={<File className="size-5" />}
                        onClick={onItemClick}
                    />
                </List>
            </Stack>
        </Stack>
    );
}
