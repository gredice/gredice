'use client';

import { clientPublic } from '@gredice/client';
import { Button } from '@gredice/ui/Button';
import { Warning } from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { Spinner } from '@gredice/ui/Spinner';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export function VerifyEmail() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get('token');
    const [error, setError] = useState<string>();
    const queryClient = useQueryClient();

    useEffect(() => {
        (async () => {
            if (!token) {
                setError('Nedostaje token za potvrdu email adrese.');
                return;
            }

            const response = await clientPublic().api.auth[
                'verify-email'
            ].$post({
                json: {
                    token,
                },
            });

            // Handle successful verification by storing the token and redirecting
            // to the home page (user is logged in)
            if (response.status === 200) {
                await response.json();
                await queryClient.invalidateQueries();
                router.push('/');
                return;
            }

            console.error(
                'Failed to verify email with status',
                response.status,
            );
            setError('Neuspješna potvrda email adrese. Pokušaj ponovno.');
        })();
    }, [router, token, queryClient]);

    if (error) {
        return (
            <Stack spacing={6}>
                <Row
                    spacing={4}
                    justifyContent="center"
                    className="text-red-500"
                >
                    <Warning className="size-6 min-w-6" />
                    <Typography>
                        Neuspješna potvrda email adrese. Pokušaj ponovno.
                    </Typography>
                </Row>
                <Button href="/" fullWidth variant="soft">
                    Povratak
                </Button>
            </Stack>
        );
    }

    return (
        <Stack spacing={6}>
            <Row spacing={4} justifyContent="center">
                <Spinner
                    loading
                    className="size-5"
                    loadingLabel="Prijava u tijeku..."
                />
                <Typography level="body2">Potvrda u tijeku...</Typography>
            </Row>
            <Typography level="body3" center>
                Pričekaj da potvrdimo tvoju email adresu.
            </Typography>
        </Stack>
    );
}
