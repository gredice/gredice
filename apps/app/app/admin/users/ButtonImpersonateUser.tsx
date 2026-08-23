'use client';

import { IconButton } from '@gredice/ui/IconButton';
import { Ghost } from '@gredice/ui/icons';
import { useRouter } from 'next/navigation';

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
        router.push('/impersonation');
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
