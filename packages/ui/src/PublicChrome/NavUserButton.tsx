'use client';

import { SquareArrowRightEnter } from '../icons';
import { NavigatingButton } from '../NavigatingButton';
import { UserAvatarLink } from '../UserAvatar';
import { useCurrentUser } from './currentUser';
import { type PublicChromeLinkMode, publicUserProfileHref } from './links';

export function NavUserButton({
    href,
    apiBasePath,
    linkMode = 'relative',
}: {
    href: string;
    apiBasePath?: string;
    linkMode?: PublicChromeLinkMode;
}) {
    const { data: user } = useCurrentUser(apiBasePath);

    return (
        <div className="flex shrink-0 items-center gap-2">
            {user ? (
                <span className="hidden sm:inline-flex">
                    <UserAvatarLink
                        href={
                            user.publicId
                                ? publicUserProfileHref(user.publicId, linkMode)
                                : undefined
                        }
                        avatarUrl={user.avatarUrl}
                        displayName={user.displayName ?? user.userName}
                        animate
                    />
                </span>
            ) : null}
            <NavigatingButton
                href={href}
                className="shrink-0 whitespace-nowrap rounded-full bg-green-800 px-3 hover:bg-green-700 dark:bg-green-700 dark:text-white dark:hover:bg-green-600 sm:pl-4"
                endDecorator={
                    <span className="hidden pl-1 sm:inline-flex">
                        <SquareArrowRightEnter aria-hidden className="size-4" />
                    </span>
                }
            >
                <span className="hidden sm:inline">
                    {user ? 'Moj vrt' : 'Moj novi vrt'}
                </span>
                <span className="sr-only sm:hidden">
                    {user ? 'Moj vrt' : 'Moj novi vrt'}
                </span>
                <SquareArrowRightEnter
                    aria-hidden
                    className="size-5 sm:hidden"
                />
            </NavigatingButton>
        </div>
    );
}
