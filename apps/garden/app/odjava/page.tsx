'use client';

import {
    clientAuthenticated,
    getBrowserGrediceAppOrigin,
} from '@gredice/client';
import { Card, CardContent, CardHeader, CardTitle } from '@gredice/ui/Card';
import { Row } from '@gredice/ui/Row';
import { Spinner } from '@gredice/ui/Spinner';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import { useEffect } from 'react';

export default function LogoutPage() {
    const queryClient = useQueryClient();

    useEffect(() => {
        const timeout = window.setTimeout(() => {
            void (async () => {
                await queryClient.invalidateQueries();
                await clientAuthenticated().api.auth.logout.$post();
                window.location.href = getBrowserGrediceAppOrigin('www');
            })();
        }, 1300);

        return () => window.clearTimeout(timeout);
    }, [queryClient]);

    return (
        <div className="flex items-center justify-center min-h-screen">
            <Card className="min-w-[350px] p-12">
                <CardHeader>
                    <Image
                        src="https://www.gredice.com/web-app-manifest-192x192.png"
                        alt="Gredice logo"
                        width={48}
                        height={48}
                        className="mx-auto size-12 mb-4"
                    />
                    <CardTitle className="text-center">Odjava</CardTitle>
                </CardHeader>
                <CardContent>
                    <Stack spacing={6}>
                        <Row spacing={4} justifyContent="center">
                            <Spinner
                                loading
                                className="size-5"
                                loadingLabel="Prijava u tijeku..."
                            />
                            <Typography level="body2">
                                Odjava u tijeku...
                            </Typography>
                        </Row>
                        <Typography level="body3" center>
                            Pričekaj dok završimo odjavu.
                        </Typography>
                    </Stack>
                </CardContent>
            </Card>
        </div>
    );
}
