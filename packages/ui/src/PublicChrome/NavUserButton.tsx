'use client';

import { SquareArrowRightEnter } from '../icons';
import { NavigatingButton } from '../NavigatingButton';
import { UserAvatar } from '../UserAvatar';
import { useCurrentUser } from './currentUser';

export function NavUserButton({
    href,
    apiBasePath,
}: {
    href: string;
    apiBasePath?: string;
}) {
    const { data: user } = useCurrentUser(apiBasePath);

    return (
        <NavigatingButton
            href={href}
            className="shrink-0 whitespace-nowrap rounded-full bg-green-800 px-3 hover:bg-green-700 dark:bg-green-700 dark:text-white dark:hover:bg-green-600 sm:px-4"
            endDecorator={
                <span className="hidden pl-1 sm:inline-flex">
                    <SquareArrowRightEnter aria-hidden className="size-4" />
                </span>
            }
            startDecorator={
                user ? (
                    <span className="hidden sm:inline-flex">
                        <UserAvatar
                            avatarUrl={user.avatarUrl}
                            displayName={user.displayName ?? user.userName}
                            className="-ml-3.5 mr-1"
                            animate
                        />
                    </span>
                ) : undefined
            }
        >
            <span className="hidden sm:inline">
                {user ? 'Moj vrt' : 'Moj novi vrt'}
            </span>
            <span className="sr-only sm:hidden">
                {user ? 'Moj vrt' : 'Moj novi vrt'}
            </span>
            <SquareArrowRightEnter aria-hidden className="size-5 sm:hidden" />
        </NavigatingButton>
    );
}
