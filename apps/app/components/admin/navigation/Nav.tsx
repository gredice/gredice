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
import type { CSSProperties } from 'react';
import { useContext, useState } from 'react';
import { reorderEntityType } from '../../../app/(actions)/entityActions';
import { KnownPages } from '../../../src/KnownPages';
import { EntityTypeIcon } from '../directories/EntityTypeIcon';
import { adminPages } from './adminPages';
import { NavContext } from './NavContext';
import { NavGroup } from './NavGroup';
import { NavItem } from './NavItem';
import { NavSection } from './NavSection';
import { ProfileNavItem } from './ProfileNavItem';

function quickActionIcon(quickAction: { href: string; icon?: string | null }) {
    if (quickAction.icon) {
        return <EntityTypeIcon icon={quickAction.icon} className="size-5" />;
    }

    switch (quickAction.href) {
        case KnownPages.Schedule:
            return <Calendar className="size-5" />;
        case KnownPages.RaisedBeds:
            return <RaisedBedIcon className="size-5" physicalId={null} />;
        case KnownPages.Operations:
            return <Hammer className="size-5" />;
        case KnownPages.DeliveryRequests:
            return <Truck className="size-5" />;
        case KnownPages.Transactions:
            return <Euro className="size-5" />;
        case KnownPages.Sunflowers:
            return <Success className="size-5" />;
        default:
            return <File className="size-5" />;
    }
}

function SortableNavItem({
    entityType,
    onClick,
    compact,
    nested,
}: {
    entityType: SelectEntityType;
    onClick?: () => void;
    compact?: boolean;
    nested?: boolean;
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
                compact={compact}
                nested={nested}
            />
        </div>
    );
}

function EntityTypeList({
    id,
    items: initialItems,
    onItemClick,
    compact,
    nested = true,
}: {
    id: string;
    items: SelectEntityType[];
    onItemClick?: () => void;
    compact?: boolean;
    nested?: boolean;
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
            id={id}
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
        >
            <SortableContext
                items={items.map((i) => i.id.toString())}
                strategy={verticalListSortingStrategy}
            >
                <div className="space-y-1">
                    {items.map((entityType) => (
                        <SortableNavItem
                            key={entityType.id}
                            entityType={entityType}
                            onClick={onItemClick}
                            compact={compact}
                            nested={nested}
                        />
                    ))}
                </div>
            </SortableContext>
        </DndContext>
    );
}

export function Nav({
    idPrefix = 'admin-nav',
    onItemClick,
    compact = false,
}: {
    idPrefix?: string;
    onItemClick?: () => void;
    compact?: boolean;
} = {}) {
    const navContext = useContext(NavContext);
    const categorizedTypes = navContext?.categorizedTypes || [];
    const uncategorizedTypes = navContext?.uncategorizedTypes || [];
    const shadowTypes = navContext?.shadowTypes || [];
    const pendingAchievementsCount = navContext?.pendingAchievementsCount ?? 0;
    const quickActions = navContext?.quickActions || [];
    const hasDirectoryRecords =
        categorizedTypes.length > 0 ||
        shadowTypes.length > 0 ||
        uncategorizedTypes.length > 0;
    const navClassName = compact ? 'space-y-1' : 'space-y-3';

    return (
        <div className={navClassName}>
            <div className="space-y-1">
                <ProfileNavItem onItemClick={onItemClick} compact={compact} />
                <NavItem
                    href={adminPages.Dashboard.href}
                    label={adminPages.Dashboard.label}
                    icon={<Home className="size-5" />}
                    strictMatch
                    onClick={onItemClick}
                    compact={compact}
                />
                {quickActions.map((quickAction) => (
                    <NavItem
                        key={quickAction.id}
                        href={quickAction.href}
                        label={quickAction.label}
                        icon={quickActionIcon(quickAction)}
                        onClick={onItemClick}
                        compact={compact}
                    />
                ))}
            </div>
            {hasDirectoryRecords && (
                <NavSection label="Zapisi" compact={compact}>
                    {/* Categories with their entity types */}
                    {categorizedTypes.map((category) => (
                        <NavGroup
                            key={category.id}
                            label={category.label}
                            icon={<File className="size-5" />}
                            compact={compact}
                        >
                            <EntityTypeList
                                id={`${idPrefix}-category-${category.id}`}
                                items={category.entityTypes}
                                onItemClick={onItemClick}
                                compact={compact}
                            />
                        </NavGroup>
                    ))}

                    {uncategorizedTypes.length > 0 && (
                        <NavGroup
                            label="Nekategorizirano"
                            icon={<File className="size-5" />}
                            compact={compact}
                        >
                            <EntityTypeList
                                id={`${idPrefix}-uncategorized`}
                                items={uncategorizedTypes}
                                onItemClick={onItemClick}
                                compact={compact}
                            />
                        </NavGroup>
                    )}

                    {shadowTypes.length > 0 && (
                        <NavGroup
                            label="Ostalo"
                            icon={<File className="size-5" />}
                            compact={compact}
                        >
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
                                    compact={compact}
                                    nested
                                />
                            ))}
                        </NavGroup>
                    )}
                </NavSection>
            )}
            <NavSection label="Administracija" compact={compact}>
                <NavGroup
                    label="Korisnici"
                    icon={<User className="size-5" />}
                    compact={compact}
                >
                    <NavItem
                        href={adminPages.Accounts.href}
                        label={adminPages.Accounts.label}
                        icon={<Bank className="size-5" />}
                        onClick={onItemClick}
                        compact={compact}
                        nested
                    />
                    <NavItem
                        href={adminPages.Users.href}
                        label={adminPages.Users.label}
                        icon={<User className="size-5" />}
                        onClick={onItemClick}
                        compact={compact}
                        nested
                    />
                    <NavItem
                        href={adminPages.Achievements.href}
                        label={adminPages.Achievements.label}
                        icon={<Success className="size-5" />}
                        onClick={onItemClick}
                        badge={pendingAchievementsCount}
                        compact={compact}
                        nested
                    />
                </NavGroup>
                <NavGroup
                    label="Financije"
                    icon={<Euro className="size-5" />}
                    compact={compact}
                >
                    <NavItem
                        href={adminPages.ShoppingCarts.href}
                        label={adminPages.ShoppingCarts.label}
                        icon={<ShoppingCart className="size-5" />}
                        onClick={onItemClick}
                        compact={compact}
                        nested
                    />
                    <NavItem
                        href={adminPages.Invoices.href}
                        label={adminPages.Invoices.label}
                        icon={<File className="size-5" />}
                        onClick={onItemClick}
                        compact={compact}
                        nested
                    />
                    <NavItem
                        href={adminPages.Transactions.href}
                        label={adminPages.Transactions.label}
                        icon={<Euro className="size-5" />}
                        onClick={onItemClick}
                        compact={compact}
                        nested
                    />
                    <NavItem
                        href={adminPages.Sunflowers.href}
                        label={adminPages.Sunflowers.label}
                        icon={<Success className="size-5" />}
                        onClick={onItemClick}
                        compact={compact}
                        nested
                    />
                    <NavItem
                        href={adminPages.Receipts.href}
                        label={adminPages.Receipts.label}
                        icon={<File className="size-5" />}
                        onClick={onItemClick}
                        compact={compact}
                        nested
                    />
                </NavGroup>
                <NavGroup
                    label="Vrtovi"
                    icon={<MapIcon className="size-5" />}
                    compact={compact}
                >
                    <NavItem
                        href={adminPages.Farms.href}
                        label={adminPages.Farms.label}
                        icon={<MapIcon className="size-5" />}
                        onClick={onItemClick}
                        compact={compact}
                        nested
                    />
                    <NavItem
                        href={adminPages.Gardens.href}
                        label={adminPages.Gardens.label}
                        icon={<Fence className="size-5" />}
                        onClick={onItemClick}
                        compact={compact}
                        nested
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
                        compact={compact}
                        nested
                    />
                    <NavItem
                        href={adminPages.Operations.href}
                        label={adminPages.Operations.label}
                        icon={<Hammer className="size-5" />}
                        onClick={onItemClick}
                        compact={compact}
                        nested
                    />
                </NavGroup>
            </NavSection>
            <NavSection label="Upravljanje" compact={compact}>
                <NavGroup
                    label="Inventar"
                    icon={<Tally3 className="size-5" />}
                    compact={compact}
                >
                    <NavItem
                        href={adminPages.Inventory.href}
                        label={adminPages.Inventory.label}
                        icon={<Tally3 className="size-5" />}
                        onClick={onItemClick}
                        compact={compact}
                        nested
                    />
                    <NavItem
                        href={adminPages.Occasions.href}
                        label={adminPages.Occasions.label}
                        icon={<Calendar className="size-5" />}
                        onClick={onItemClick}
                        compact={compact}
                        nested
                    />
                </NavGroup>
                <NavGroup
                    label="Logistika"
                    icon={<Truck className="size-5" />}
                    compact={compact}
                >
                    <NavItem
                        href={adminPages.Schedule.href}
                        label={adminPages.Schedule.label}
                        icon={<Calendar className="size-5" />}
                        onClick={onItemClick}
                        compact={compact}
                        nested
                    />
                    <NavItem
                        href={adminPages.DeliverySlots.href}
                        label={adminPages.DeliverySlots.label}
                        icon={<Truck className="size-5" />}
                        onClick={onItemClick}
                        compact={compact}
                        nested
                    />
                    <NavItem
                        href={adminPages.DeliveryRequests.href}
                        label={adminPages.DeliveryRequests.label}
                        icon={<Truck className="size-5" />}
                        onClick={onItemClick}
                        compact={compact}
                        nested
                    />
                </NavGroup>
                <NavGroup
                    label="Izvještaji"
                    icon={<Tally3 className="size-5" />}
                    compact={compact}
                >
                    <NavGroup
                        label="Statistika"
                        icon={<Tally3 className="size-5" />}
                        compact={compact}
                        depth={1}
                    >
                        <NavItem
                            href={adminPages.SowingStatistics.href}
                            label={adminPages.SowingStatistics.label}
                            icon={<Tally3 className="size-5" />}
                            onClick={onItemClick}
                            compact={compact}
                            nested
                        />
                    </NavGroup>
                </NavGroup>
            </NavSection>
            <NavSection label="Komunikacija" compact={compact}>
                <NavGroup
                    label="Poruke"
                    icon={<Inbox className="size-5" />}
                    compact={compact}
                >
                    <NavItem
                        href={adminPages.CommunicationInbox.href}
                        label={adminPages.CommunicationInbox.label}
                        icon={<Inbox className="size-5" />}
                        onClick={onItemClick}
                        compact={compact}
                        nested
                    />
                    <NavItem
                        href={adminPages.CommunicationEmails.href}
                        label={adminPages.CommunicationEmails.label}
                        icon={<Mail className="size-5" />}
                        onClick={onItemClick}
                        compact={compact}
                        nested
                    />
                    <NavItem
                        href={adminPages.Notifications.href}
                        label={adminPages.Notifications.label}
                        icon={<Megaphone className="size-5" />}
                        onClick={onItemClick}
                        compact={compact}
                        nested
                    />
                    <NavItem
                        href={adminPages.Feedback.href}
                        label={adminPages.Feedback.label}
                        icon={<SmileHappy className="size-5" />}
                        onClick={onItemClick}
                        compact={compact}
                        nested
                    />
                </NavGroup>
            </NavSection>
            <NavSection label="Sustavi" compact={compact}>
                <NavGroup
                    label="Održavanje"
                    icon={<File className="size-5" />}
                    compact={compact}
                >
                    <NavItem
                        href={adminPages.Sensors.href}
                        label={adminPages.Sensors.label}
                        icon={<File className="size-5" />}
                        onClick={onItemClick}
                        compact={compact}
                        nested
                    />
                    <NavItem
                        href={adminPages.Cache.href}
                        label={adminPages.Cache.label}
                        icon={<File className="size-5" />}
                        onClick={onItemClick}
                        compact={compact}
                        nested
                    />
                    <NavItem
                        href={adminPages.AiAnalytics.href}
                        label={adminPages.AiAnalytics.label}
                        icon={<AI className="size-5" />}
                        onClick={onItemClick}
                        compact={compact}
                        nested
                    />
                </NavGroup>
            </NavSection>
            <NavSection label="Postavke" compact={compact}>
                <NavGroup
                    label="Aplikacija"
                    icon={<Settings className="size-5" />}
                    compact={compact}
                >
                    <NavItem
                        href={adminPages.Settings.href}
                        label={adminPages.Settings.label}
                        icon={<Settings className="size-5" />}
                        onClick={onItemClick}
                        compact={compact}
                        nested
                    />
                </NavGroup>
            </NavSection>
        </div>
    );
}
