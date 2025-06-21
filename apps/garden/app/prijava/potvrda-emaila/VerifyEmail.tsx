'use client';

import { Button } from "@signalco/ui-primitives/Button";
import { Row } from "@signalco/ui-primitives/Row";
import { Spinner } from "@signalco/ui-primitives/Spinner";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Warning } from "@signalco/ui-icons";
import { client } from "@gredice/client";
import { useQueryClient } from "@tanstack/react-query";

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

            const response = await client().api.auth["verify-email"].$post({
                json: {
                    token
                }
            });

            // Handle successful verification by storing the token and redirecting
            // to the home page (user is logged in)
            if (response.status === 200) {
                const { token: jwtToken } = await response.json();
                localStorage.setItem('gredice-token', jwtToken);
                await queryClient.invalidateQueries();
                router.push('/');
                return;
            }

            console.error('Failed to verify email with status', response.status);
            setError('Neuspješna potvrda email adrese. Pokušaj ponovno.');
        })();
    }, [router, token, queryClient]);

    if (error) {
        return (
            <Stack spacing={3}>
                <Row spacing={2} justifyContent='center' className="text-red-500">
                    <Warning className="size-6 min-w-6" />
                    <Typography>Neuspješna potvrda email adrese. Pokušaj ponovno.</Typography>
                </Row>
                <Button href='/' fullWidth variant='soft'>Povratak</Button>
            </Stack>
        );
    }

    return (
        <Stack spacing={3}>
            <Row spacing={2} justifyContent='center'>
                <Spinner loading className='size-5' loadingLabel="Prijava u tijeku..." />
                <Typography level='body2'>Potvrda u tijeku...</Typography>
            </Row>
            <Typography level='body3' center>
                Pričekaj da potvrdimo tvoju email adresu.
            </Typography>
        </Stack>
    );
}