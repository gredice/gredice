import { Card, CardContent } from '@gredice/ui/Card';
import { Spinner } from '@gredice/ui/Spinner';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { Suspense } from 'react';
import { UrlAuthForward } from '../../app/prijava/UrlAuthForward';

export function OAuthCallbackPanel({ provider }: { provider: string }) {
    return (
        <main className="flex min-h-[100dvh] w-full items-center justify-center bg-background p-4">
            <Card className="w-full max-w-sm">
                <CardContent noHeader className="p-8">
                    <Stack spacing={4} className="items-center text-center">
                        <Spinner loading loadingLabel="Prijava u tijeku" />
                        <Typography level="h3" semiBold>
                            {provider} prijava
                        </Typography>
                        <Typography className="text-muted-foreground">
                            Pričekaj dok pripremimo aplikaciju dostave.
                        </Typography>
                    </Stack>
                </CardContent>
            </Card>
            <Suspense>
                <UrlAuthForward />
            </Suspense>
        </main>
    );
}
