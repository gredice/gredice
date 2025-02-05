'use client';

import { Button } from "@signalco/ui-primitives/Button";
import { Typography } from "@signalco/ui-primitives/Typography";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { apiFetch } from "../../lib/apiFetch";

export function SendVerifyEmailButton() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const email = searchParams.get('email');
    const [isLoading, setIsLoading] = useState(false);
    const handleSend = async () => {
        setIsLoading(true);
        const response = await apiFetch('/api/auth/send-verify-email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email })
        });
        if (response.status !== 201) {
            setIsLoading(false);
            console.error('Failed to send verify email with status', response.status);
            // TODO: Show error
            return;
        }

        router.push('/prijava/potvrda-emaila/poslano');
    }

    return (
        <>
            <Button fullWidth variant='soft' onClick={handleSend} disabled={!email} loading={isLoading}>
                Pošalji ponovno
            </Button>
            {!email && (
                <Typography level="body3" center>
                    Nismo pronašli email adresu za slanje. Pokušaj ponovno ili kontaktiraj podršku.
                </Typography>
            )}
        </>
    );
}
