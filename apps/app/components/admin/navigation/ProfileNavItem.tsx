'use client';

import { UserAvatar } from '@gredice/ui/UserAvatar';
import { Bank, LogOut, User } from '@signalco/ui-icons';
import { ListItem } from '@signalco/ui-primitives/ListItem';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@signalco/ui-primitives/Menu';
import { useEffect, useMemo, useState } from 'react';
import { KnownPages } from '../../../src/KnownPages';

type CurrentUser = {
    id?: string;
    userName?: string | null;
    avatarUrl?: string | null;
    accounts?: Array<{ accountId?: string | null }>;
};

function isCurrentUser(value: unknown): value is CurrentUser {
    return typeof value === 'object' && value !== null;
}

function resolveAccountId(currentUser: CurrentUser | null): string | null {
    const accountId = currentUser?.accounts?.[0]?.accountId;
    return accountId ?? null;
}

export function ProfileNavItem({
    onItemClick,
    compact = false,
}: {
    onItemClick?: () => void;
    compact?: boolean;
} = {}) {
    const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

    useEffect(() => {
        let cancelled = false;

        const loadCurrentUser = async () => {
            const response = await fetch('/api/users/current', {
                cache: 'no-store',
            });
            if (!response.ok || cancelled) {
                return;
            }

            const user = await response.json();
            if (!cancelled && isCurrentUser(user)) {
                setCurrentUser(user);
            }
        };

        void loadCurrentUser();

        return () => {
            cancelled = true;
        };
    }, []);

    const userName = currentUser?.userName ?? 'Korisnik';
    const userHref = useMemo(
        () =>
            currentUser?.id
                ? KnownPages.User(currentUser.id)
                : KnownPages.Users,
        [currentUser?.id],
    );
    const accountHref = useMemo(() => {
        const accountId = resolveAccountId(currentUser);
        return accountId ? KnownPages.Account(accountId) : KnownPages.Accounts;
    }, [currentUser]);
    const listItemAccessibilityProps = compact
        ? { 'aria-label': userName }
        : {};

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <ListItem
                    {...listItemAccessibilityProps}
                    title={userName}
                    startDecorator={
                        <UserAvatar
                            displayName={userName}
                            avatarUrl={currentUser?.avatarUrl}
                            size="sm"
                        />
                    }
                    label={compact ? '' : userName}
                />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
                <DropdownMenuItem
                    startDecorator={<User className="size-5" />}
                    href={userHref}
                    onClick={onItemClick}
                >
                    Detalji korisnika
                </DropdownMenuItem>
                <DropdownMenuItem
                    startDecorator={<Bank className="size-5" />}
                    href={accountHref}
                    onClick={onItemClick}
                >
                    Detalji računa
                </DropdownMenuItem>
                <DropdownMenuItem
                    startDecorator={<LogOut className="size-5" />}
                    href={KnownPages.Logout}
                    onClick={onItemClick}
                >
                    Odjava
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
