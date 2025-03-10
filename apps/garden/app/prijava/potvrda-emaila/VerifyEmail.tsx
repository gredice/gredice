'use client';

import { Button } from "@signalco/ui-primitives/Button";
import { Row } from "@signalco/ui-primitives/Row";
import { Spinner } from "@signalco/ui-primitives/Spinner";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";
import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "../../../lib/apiFetch";

export function VerifyEmail() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get('token');
    const [error, setError] = useState<string>();

    useEffect(() => {
        (async () => {
            if (!token) {
                setError('Nedostaje token za potvrdu email adrese.');
                return;
            }

            const response = await apiFetch('/api/auth/verify-email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ token: window.location.search.split('=')[1] })
            });
            if (response.status !== 204) {
                console.error('Failed to verify email with status', response.status);
                setError('Neuspješna potvrda email adrese. Pokušaj ponovno.');
                return;
            }

            router.push('/'); // Redirect to home page
        })();
    }, [router, token]);

    if (error) {
        return (
            <Stack spacing={3}>
                <Row spacing={1} justifyContent='center' className="text-red-500">
                    <TriangleAlert className="size-6 min-w-6" />
                    <Typography>Neuspješna potvrda email adrese. Pokušaj ponovno.</Typography>
                </Row>
                <Link href='/' legacyBehavior passHref>
                    <Button fullWidth variant='soft'>Povratak</Button>
                </Link>
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