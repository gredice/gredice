'use client';

import { UserAvatar } from '@gredice/ui/UserAvatar';
import { NavigatingButton } from '@signalco/ui/NavigatingButton';
import { useCurrentUser } from '../hooks/useCurrentUser';

export function NavUserButton({ href }: { href: string }) {
    const { data: user } = useCurrentUser();

    return (
        <NavigatingButton
            href={href}
            className="bg-green-800 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 dark:text-white rounded-full"
            startDecorator={
                user ? (
                    <UserAvatar
                        avatarUrl={user.avatarUrl}
                        displayName={user.displayName ?? user.userName}
                        className="-ml-3.5 mr-1"
                        animate
                    />
                ) : undefined
            }
        >
            {user ? 'Moj vrt' : 'Moj novi vrt'}
        </NavigatingButton>
    );
}
