'use client';

import { IconButton } from "@signalco/ui-primitives/IconButton";
import { Ghost } from "@signalco/ui-icons";

export function ButtonImpersonateUser({ userId }: { userId: string }) {
    const handleImpersonate = async () => {
        // TODO: Implement
        console.error(`Failed to impersonate user ${userId}`);
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