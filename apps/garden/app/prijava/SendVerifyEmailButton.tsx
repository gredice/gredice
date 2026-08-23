'use client';

import { clientPublic } from '@gredice/client';
import { Button } from '@gredice/ui/Button';
import { showNotification } from '@gredice/ui/notifications';
import { Typography } from '@gredice/ui/Typography';
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
        try {
            const response = await clientPublic().api.auth[
                'send-verify-email'
            ].$post({
                json: {
                    email,
                },
            });

            if (response.ok) {
                router.push('/prijava/potvrda-emaila/poslano');
                return;
            }

            showNotification(errorMessages.verificationEmail, 'error');
        } catch {
            showNotification(errorMessages.verificationEmail, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <Button
                fullWidth
                variant="soft"
                onClick={handleSend}
                disabled={!email}
                loading={isLoading}
                size="lg"
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
