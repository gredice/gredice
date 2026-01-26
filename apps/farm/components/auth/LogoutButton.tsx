'use client';

import { clearStoredTokens } from '@gredice/client';
import { authCurrentUserQueryKeys } from '@signalco/auth-client';
import { LogOut } from '@signalco/ui-icons';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { queryClient } from '../providers/ClientAppProvider';

export function LogoutButton() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const handleLogout = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/logout', { method: 'POST' });
            if (!response.ok) {
                console.error('Logout failed with status', response.status);
                return;
            }

            clearStoredTokens();
            await queryClient.invalidateQueries({
                queryKey: authCurrentUserQueryKeys,
            });
            router.refresh();
        } catch (cause) {
            console.error('Logout request failed', cause);
        } finally {
            setLoading(false);
        }
    };

    return (
        <IconButton
            title="Odjavi se"
            variant="outlined"
            loading={loading}
            onClick={handleLogout}
            className="whitespace-nowrap"
        >
            <LogOut className="size-4 shrink-0" />
        </IconButton>
    );
}
