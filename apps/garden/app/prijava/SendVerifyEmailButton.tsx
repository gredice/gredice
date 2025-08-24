'use client';

import { client } from '@gredice/client';
import { showNotification } from '@signalco/ui-notifications';
import { Button } from '@signalco/ui-primitives/Button';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { errorMessages } from '../../misc/errorMessages';

export function SendVerifyEmailButton() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const email = searchParams.get('email');
    const [isLoading, setIsLoading] = useState(false);
    const handleSend = async () => {
        if (!email) {
            showNotification(errorMessages.verifyEmailInvalid, 'error');
            return;
        }

        setIsLoading(true);
        const response = await client().api.auth['send-verify-email'].$post({
            json: {
                email,
            },
        });

        if (response.status === 404 || response) {
            setIsLoading(false);
            showNotification(errorMessages.verificationEmail, 'error');
            return;
        }

        router.push('/prijava/potvrda-emaila/poslano');
    };

    return (
        <>
            <Button
                fullWidth
                variant="soft"
                onClick={handleSend}
                disabled={!email}
                loading={isLoading}
            >
                Pošalji ponovno
            </Button>
            {!email && (
                <Typography level="body3" center>
                    Nismo pronašli email adresu za slanje. Pokušaj ponovno ili
                    kontaktiraj podršku.
                </Typography>
            )}
        </>
    );
}
