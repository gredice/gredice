import { Card, CardContent, CardHeader, CardTitle } from '@gredice/ui/Card';
import { Row } from '@gredice/ui/Row';
import { Spinner } from '@gredice/ui/Spinner';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { Suspense } from 'react';
import { UrlAuthForward } from '../../app/prijava/UrlAuthForward';

export function OAuthCallbackStatus({ provider }: { provider: string }) {
    return (
        <div className="flex min-h-[70dvh] items-center justify-center p-4">
            <Card className="w-[350px] p-8">
                <CardHeader>
                    <CardTitle className="text-center">
                        {provider} prijava
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <Stack spacing={6}>
                        <Row spacing={4} justifyContent="center">
                            <Spinner
                                className="size-5"
                                loading
                                loadingLabel="Prijava u tijeku..."
                            />
                            <Typography level="body2">
                                Prijava u tijeku...
                            </Typography>
                        </Row>
                        <Typography level="body3" center>
                            Pričekaj dok završimo tvoju prijavu.
                        </Typography>
                    </Stack>
                </CardContent>
            </Card>
            <Suspense>
                <UrlAuthForward />
            </Suspense>
        </div>
    );
}
