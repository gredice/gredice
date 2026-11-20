'use client';

import { Bank, ExpandDown, LogOut, User } from '@gredice/ui/icons';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@gredice/ui/Menu';
import { UserAvatar } from '@gredice/ui/UserAvatar';
import { useEffect, useMemo, useState } from 'react';
import { KnownPages } from '../../../src/KnownPages';

type CurrentUser = {
    id?: string;
    userName?: string | null;
    displayName?: string | null;
    avatarUrl?: string | null;
    achievementCount?: number;
    accounts?: Array<{ accountId?: string | null }>;
};

const menuItemClassName = 'h-9 rounded-md px-2';

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
    nested = false,
}: {
    onItemClick?: () => void;
    compact?: boolean;
    nested?: boolean;
} = {}) {
    const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

    useEffect(() => {
        let cancelled = false;

        const loadCurrentUser = async () => {
            const response = await fetch('/api/users/current-claims', {
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

    const userName =
        currentUser?.displayName?.trim() || currentUser?.userName || 'Korisnik';
    const userSubtitle =
        currentUser?.userName && currentUser.userName !== userName
            ? currentUser.userName
            : null;
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
    const guideLineClassName =
        compact || !nested
            ? ''
            : "before:absolute before:-left-3 before:top-1/2 before:h-px before:w-3 before:bg-border/55 before:content-['']";
    const triggerClassName = [
        'group/nav-item relative flex w-full items-center gap-2 rounded-md text-foreground text-sm outline-hidden transition-colors hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        compact ? 'h-9 justify-center px-0' : 'h-8 px-2',
        guideLineClassName,
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    {...listItemAccessibilityProps}
                    title={userName}
                    className={triggerClassName}
                >
                    <UserAvatar
                        achievementCount={currentUser?.achievementCount}
                        displayName={userName}
                        avatarUrl={currentUser?.avatarUrl}
                        size="sm"
                    />
                    {!compact && (
                        <>
                            <span className="min-w-0 flex-1 truncate text-left">
                                {userName}
                            </span>
                            <ExpandDown
                                aria-hidden
                                className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[popup-open]/nav-item:rotate-180"
                            />
                        </>
                    )}
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
                <DropdownMenuLabel className="flex items-center gap-3 px-2 py-2 font-normal">
                    <UserAvatar
                        achievementCount={currentUser?.achievementCount}
                        displayName={userName}
                        avatarUrl={currentUser?.avatarUrl}
                        size="md"
                    />
                    <span className="flex min-w-0 flex-col">
                        <span className="truncate font-semibold text-foreground">
                            {userName}
                        </span>
                        {userSubtitle && (
                            <span className="truncate text-muted-foreground text-xs">
                                {userSubtitle}
                            </span>
                        )}
                    </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    <DropdownMenuItem
                        className={menuItemClassName}
                        startDecorator={
                            <User className="size-4 shrink-0 text-muted-foreground" />
                        }
                        href={userHref}
                        onClick={onItemClick}
                    >
                        Detalji korisnika
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        className={menuItemClassName}
                        startDecorator={
                            <Bank className="size-4 shrink-0 text-muted-foreground" />
                        }
                        href={accountHref}
                        onClick={onItemClick}
                    >
                        Detalji računa
                    </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    className={menuItemClassName}
                    startDecorator={
                        <LogOut className="size-4 shrink-0 text-muted-foreground" />
                    }
                    href={KnownPages.Logout}
                    onClick={onItemClick}
                >
                    Odjava
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
