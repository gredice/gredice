'use client';

import { Ghost } from '@signalco/ui-icons';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { useRouter } from 'next/navigation';

function getGardenUrl() {
    if (
        typeof window !== 'undefined' &&
        window.location.hostname.includes('.test')
    ) {
        return 'https://vrt.gredice.test';
    }
    return 'https://vrt.gredice.com';
}

export function ButtonImpersonateUser({ userId }: { userId: string }) {
    const router = useRouter();

    const handleImpersonate = async () => {
        const response = await fetch(
            `/api/users/${encodeURIComponent(userId)}/impersonate`,
            {
                method: 'POST',
            },
        );
        if (!response.ok) {
            console.error(`Failed to impersonate user ${userId}`);
            return;
        }
        router.push(getGardenUrl());
    };

    return (
        <IconButton
            variant="outlined"
            onClick={handleImpersonate}
            title="Prijavi se kao korisnik"
        >
            <Ghost className="size-5" />
        </IconButton>
    );
}
