'use client';

import { initials } from '@signalco/js';
import { NavigatingButton } from '@signalco/ui/NavigatingButton';
import { Avatar } from '@signalco/ui-primitives/Avatar';
import { useQuery } from '@tanstack/react-query';

type CurrentUser = {
    id: string;
    userName: string;
    displayName?: string;
    avatarUrl?: string | null;
};

async function fetchCurrentUser(): Promise<CurrentUser | null> {
    try {
        const response = await fetch('/api/gredice/api/users/current', {
            cache: 'no-store',
        });
        if (response.ok) {
            return (await response.json()) as CurrentUser;
        }

        if (response.status === 401) {
            // Refresh token flow sets the session cookie on 401; retry once.
            const retryResponse = await fetch(
                '/api/gredice/api/users/current',
                {
                    cache: 'no-store',
                },
            );
            if (retryResponse.ok) {
                return (await retryResponse.json()) as CurrentUser;
            }
        }

        return null;
    } catch {
        return null;
    }
}

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
    const { data: user } = useQuery({
        queryKey: ['currentUser'],
        queryFn: fetchCurrentUser,
        retry: false,
        staleTime: 5 * 60 * 1000,
    });

    return (
        <NavigatingButton
            href={href}
            className="bg-green-800 hover:bg-green-700 rounded-full"
            startDecorator={user ? <UserAvatar user={user} /> : undefined}
        >
            Moj vrt
        </NavigatingButton>
    );
}
