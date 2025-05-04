'use client';

import { IconButton } from "@signalco/ui-primitives/IconButton";
import { Ghost } from "@signalco/ui-icons";

export function ButtonImpersonateUser({ userId }: { userId: string }) {
    const handleImpersonate = async () => {
        const response = await fetch(`/api/users/${userId}/impersonate`, { method: 'POST' });
        if (response.status === 201) {
            location.reload();
        }

        // TODO: Show notification
        console.error('Failed to impersonate user', response.status);
    }

    return (
        <IconButton
            variant="outlined"
            onClick={handleImpersonate}
            title="Prijavi se kao korisnik">
            <Ghost className="size-5" />
        </IconButton>
    )
}