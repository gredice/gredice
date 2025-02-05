'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@signalco/ui-primitives/Card";
import { Row } from "@signalco/ui-primitives/Row";
import { Spinner } from "@signalco/ui-primitives/Spinner";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";
import Image from "next/image";
import { useTimeout } from '@signalco/hooks/useTimeout';
import { apiFetch } from "../../lib/apiFetch";

export default function LogoutPage() {
    useTimeout(async () => {
        localStorage.removeItem('gredice-token');
        await apiFetch('/api/auth/logout', { method: 'POST' });
        window.location.href = 'https://www.gredice.com';
    }, 1300);

    return (
        <div className="flex items-center justify-center min-h-screen">
            <Card className="min-w-[350px]">
                <CardHeader>
                    <Image
                        src="https://www.gredice.com/android-chrome-192x192.png"
                        alt="Gredice logo"
                        width={48}
                        height={48}
                        className="mx-auto size-12 mb-4" />
                    <CardTitle className='text-center'>Odjava</CardTitle>
                </CardHeader>
                <CardContent>
                    <Stack spacing={3}>
                        <Row spacing={2} justifyContent='center'>
                            <Spinner loading className='size-5' loadingLabel="Prijava u tijeku..." />
                            <Typography level='body2'>Odjava u tijeku...</Typography>
                        </Row>
                        <Typography level='body3' center>
                            Pričekaj dok završimo odjavu.
                        </Typography>
                    </Stack>
                </CardContent>
            </Card>
        </div>
    )
}