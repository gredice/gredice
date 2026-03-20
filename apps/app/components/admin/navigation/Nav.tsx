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
import { RaisedBedIcon } from '@gredice/ui/RaisedBedIcon';
import { AuthProtectedSection } from '@signalco/auth-client/components';
import {
    Bank,
    Calendar,
    Euro,
    Fence,
    File,
    Hammer,
    Home,
    Inbox,
    Mail,
    Map as MapIcon,
    Megaphone,
    Settings,
    ShoppingCart,
    SmileHappy,
    Success,
    Tally3,
    Truck,
    User,
} from '@signalco/ui-icons';
import { List, ListHeader } from '@signalco/ui-primitives/List';
import { ListTreeItem } from '@signalco/ui-primitives/ListTreeItem';
import { Stack } from '@signalco/ui-primitives/Stack';
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
    const navContext = useContext(NavContext);
    const categorizedTypes = navContext?.categorizedTypes || [];
    const uncategorizedTypes = navContext?.uncategorizedTypes || [];
    const shadowTypes = navContext?.shadowTypes || [];
    const pendingAchievementsCount = navContext?.pendingAchievementsCount ?? 0;

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
                            <ListHeader header={category.label} />
                            <EntityTypeList
                                items={category.entityTypes}
                                onItemClick={onItemClick}
                            />
                        </Stack>
                    ))}
                </AuthProtectedSection>

                <ListHeader header="Zapisi" />
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
                        href={KnownPages.Achievements}
                        label="Postignuća"
                        icon={<Success className="size-5" />}
                        onClick={onItemClick}
                        badge={pendingAchievementsCount}
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
                        href={KnownPages.Farms}
                        label="Farme"
                        icon={<MapIcon className="size-5" />}
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
                        icon={<RaisedBedIcon className="size-5" />}
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
                        href={KnownPages.Inventory}
                        label="Zalihe"
                        icon={<Tally3 className="size-5" />}
                        onClick={onItemClick}
                    />
                    <NavItem
                        href={KnownPages.Occasions}
                        label="Prigode"
                        icon={<Calendar className="size-5" />}
                        onClick={onItemClick}
                    />
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
                        href={KnownPages.CommunicationEmails}
                        label="Poslani emailovi"
                        icon={<Mail className="size-5" />}
                        onClick={onItemClick}
                    />
                    <NavItem
                        href={KnownPages.Notifications}
                        label="Obavijesti"
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
                <ListHeader header="Postavke" />
                <List>
                    <NavItem
                        href={KnownPages.Settings}
                        label="Postavke"
                        icon={<Settings className="size-5" />}
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
