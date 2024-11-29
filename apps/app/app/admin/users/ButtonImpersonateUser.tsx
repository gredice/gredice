'use client';

import { Button } from "@signalco/ui-primitives/Button";
import { Ghost } from "lucide-react";

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
        <Button
            size="sm"
            variant="outlined"
            onClick={handleImpersonate}
            startDecorator={<Ghost className="size-5" />}>
            Impersonate
        </Button>
    )
}