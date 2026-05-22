'use client';

import { getBrowserGrediceAppOrigin } from '@gredice/client';
import { IconButton } from '@gredice/ui/IconButton';
import { Ghost } from '@gredice/ui/icons';
import { useRouter } from 'next/navigation';

function getGardenUrl() {
    return getBrowserGrediceAppOrigin('garden');
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
