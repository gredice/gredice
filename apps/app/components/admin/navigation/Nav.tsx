'use client';

import { AuthProtectedSection } from '@signalco/auth-client/components';
import {
    Add,
    Bank,
    Book,
    Calendar,
    Down,
    Edit,
    Euro,
    Fence,
    File,
    Hammer,
    Home,
    Inbox,
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
import { useContext } from 'react';
import { KnownPages } from '../../../src/KnownPages';
import { NavContext } from './NavContext';
import { NavItem } from './NavItem';
import { ProfileNavItem } from './ProfileNavItem';

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
                        <List>
                            {uncategorizedTypes.map((entityType) => (
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
                        </List>
                    )}

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
                            <List>
                                {category.entityTypes.map((entityType) => (
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
                            </List>
                        </Stack>
                    ))}
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
