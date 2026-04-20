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
    AI,
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
import { EntityTypeIcon } from '../directories/EntityTypeIcon';
import { adminPages } from './adminPages';
import { NavContext } from './NavContext';
import { NavItem } from './NavItem';
import { ProfileNavItem } from './ProfileNavItem';

function quickActionIcon(quickAction: { href: string; icon?: string | null }) {
    if (quickAction.icon) {
        return <EntityTypeIcon icon={quickAction.icon} className="size-5" />;
    }

    switch (quickAction.href) {
        case KnownPages.Schedule:
            return <Calendar className="size-5" />;
        case KnownPages.RaisedBeds:
            return <RaisedBedIcon className="size-5" />;
        case KnownPages.Operations:
            return <Hammer className="size-5" />;
        case KnownPages.DeliveryRequests:
            return <Truck className="size-5" />;
        case KnownPages.Transactions:
            return <Euro className="size-5" />;
        default:
            return <File className="size-5" />;
    }
}

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
                icon={
                    <EntityTypeIcon icon={entityType.icon} className="size-5" />
                }
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
    const quickActions = navContext?.quickActions || [];

    return (
        <Stack spacing={2}>
            <List>
                <ProfileNavItem onItemClick={onItemClick} />
                <NavItem
                    href={adminPages.Dashboard.href}
                    label={adminPages.Dashboard.label}
                    icon={<Home className="size-5" />}
                    strictMatch
                    onClick={onItemClick}
                />
                {quickActions.map((quickAction) => (
                    <NavItem
                        key={quickAction.id}
                        href={quickAction.href}
                        label={quickAction.label}
                        icon={quickActionIcon(quickAction)}
                        onClick={onItemClick}
                    />
                ))}
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
                                    icon={
                                        <EntityTypeIcon
                                            icon={entityType.icon}
                                            className="size-5"
                                        />
                                    }
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
                        href={adminPages.Accounts.href}
                        label={adminPages.Accounts.label}
                        icon={<Bank className="size-5" />}
                        onClick={onItemClick}
                    />
                    <NavItem
                        href={adminPages.Achievements.href}
                        label={adminPages.Achievements.label}
                        icon={<Success className="size-5" />}
                        onClick={onItemClick}
                        badge={pendingAchievementsCount}
                    />
                    <NavItem
                        href={adminPages.ShoppingCarts.href}
                        label={adminPages.ShoppingCarts.label}
                        icon={<ShoppingCart className="size-5" />}
                        onClick={onItemClick}
                    />
                    <NavItem
                        href={adminPages.Invoices.href}
                        label={adminPages.Invoices.label}
                        icon={<File className="size-5" />}
                        onClick={onItemClick}
                    />
                    <NavItem
                        href={adminPages.Transactions.href}
                        label={adminPages.Transactions.label}
                        icon={<Euro className="size-5" />}
                        onClick={onItemClick}
                    />
                    <NavItem
                        href={adminPages.Receipts.href}
                        label={adminPages.Receipts.label}
                        icon={<File className="size-5" />}
                        onClick={onItemClick}
                    />
                    <NavItem
                        href={adminPages.Users.href}
                        label={adminPages.Users.label}
                        icon={<User className="size-5" />}
                        onClick={onItemClick}
                    />
                    <NavItem
                        href={adminPages.Farms.href}
                        label={adminPages.Farms.label}
                        icon={<MapIcon className="size-5" />}
                        onClick={onItemClick}
                    />
                    <NavItem
                        href={adminPages.Gardens.href}
                        label={adminPages.Gardens.label}
                        icon={<Fence className="size-5" />}
                        onClick={onItemClick}
                    />
                    <NavItem
                        href={adminPages.RaisedBeds.href}
                        label={adminPages.RaisedBeds.label}
                        icon={
                            <RaisedBedIcon
                                className="size-5"
                                physicalId={null}
                            />
                        }
                        onClick={onItemClick}
                    />
                    <NavItem
                        href={adminPages.Operations.href}
                        label={adminPages.Operations.label}
                        icon={<Hammer className="size-5" />}
                        onClick={onItemClick}
                    />
                </List>
            </Stack>
            <Stack spacing={1}>
                <ListHeader header="Upravljanje" />
                <List>
                    <NavItem
                        href={adminPages.Inventory.href}
                        label={adminPages.Inventory.label}
                        icon={<Tally3 className="size-5" />}
                        onClick={onItemClick}
                    />
                    <NavItem
                        href={adminPages.Occasions.href}
                        label={adminPages.Occasions.label}
                        icon={<Calendar className="size-5" />}
                        onClick={onItemClick}
                    />
                    <NavItem
                        href={adminPages.Schedule.href}
                        label={adminPages.Schedule.label}
                        icon={<Calendar className="size-5" />}
                        onClick={onItemClick}
                    />
                    <NavItem
                        href={adminPages.DeliverySlots.href}
                        label={adminPages.DeliverySlots.label}
                        icon={<Truck className="size-5" />}
                        onClick={onItemClick}
                    />
                    <NavItem
                        href={adminPages.DeliveryRequests.href}
                        label={adminPages.DeliveryRequests.label}
                        icon={<Truck className="size-5" />}
                        onClick={onItemClick}
                    />
                </List>
            </Stack>
            <Stack spacing={1}>
                <ListHeader header="Komunikacija" />
                <List>
                    <NavItem
                        href={adminPages.CommunicationInbox.href}
                        label={adminPages.CommunicationInbox.label}
                        icon={<Inbox className="size-5" />}
                        onClick={onItemClick}
                    />
                    <NavItem
                        href={adminPages.CommunicationEmails.href}
                        label={adminPages.CommunicationEmails.label}
                        icon={<Mail className="size-5" />}
                        onClick={onItemClick}
                    />
                    <NavItem
                        href={adminPages.Notifications.href}
                        label={adminPages.Notifications.label}
                        icon={<Megaphone className="size-5" />}
                        onClick={onItemClick}
                    />
                    <NavItem
                        href={adminPages.Feedback.href}
                        label={adminPages.Feedback.label}
                        icon={<SmileHappy className="size-5" />}
                        onClick={onItemClick}
                    />
                </List>
            </Stack>
            <Stack spacing={1}>
                <ListHeader header="Postavke" />
                <List>
                    <NavItem
                        href={adminPages.Settings.href}
                        label={adminPages.Settings.label}
                        icon={<Settings className="size-5" />}
                        onClick={onItemClick}
                    />
                </List>
            </Stack>
            <Stack spacing={1}>
                <ListHeader header="Sustavi" />
                <List>
                    <NavItem
                        href={adminPages.Sensors.href}
                        label={adminPages.Sensors.label}
                        icon={<File className="size-5" />}
                        onClick={onItemClick}
                    />
                    <NavItem
                        href={adminPages.Cache.href}
                        label={adminPages.Cache.label}
                        icon={<File className="size-5" />}
                        onClick={onItemClick}
                    />
                    <NavItem
                        href={adminPages.AiAnalytics.href}
                        label={adminPages.AiAnalytics.label}
                        icon={<AI className="size-5" />}
                        onClick={onItemClick}
                    />
                </List>
            </Stack>
        </Stack>
    );
}
