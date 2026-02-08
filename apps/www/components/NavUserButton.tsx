'use client';

import { initials } from '@signalco/js';
import { NavigatingButton } from '@signalco/ui/NavigatingButton';
import { Avatar } from '@signalco/ui-primitives/Avatar';
import { type CurrentUser, useCurrentUser } from '../hooks/useCurrentUser';

function UserAvatar({ user }: { user: CurrentUser }) {
    const displayName = user.displayName ?? user.userName;

    if (user.avatarUrl) {
        return (
            <Avatar
                src={user.avatarUrl}
                alt={displayName}
                className="-ml-3.5 mr-1 animate-[avatar-in_300ms_ease-out]"
            />
        );
    }

    return (
        <Avatar size="sm" className="-ml-1 animate-[avatar-in_300ms_ease-out]">
            {initials(displayName)}
        </Avatar>
    );
}

export function NavUserButton({ href }: { href: string }) {
    const { data: user } = useCurrentUser();

    return (
        <NavigatingButton
            href={href}
            className="bg-green-800 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 dark:text-white rounded-full"
            startDecorator={user ? <UserAvatar user={user} /> : undefined}
        >
            {user ? 'Moj vrt' : 'Moj novi vrt'}
        </NavigatingButton>
    );
}
