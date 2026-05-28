import { Card, CardContent, CardHeader, CardTitle } from '@gredice/ui/Card';
import { Row } from '@gredice/ui/Row';
import { Spinner } from '@gredice/ui/Spinner';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { Suspense } from 'react';
import { UrlAuthForward } from '../../UrlAuthForward';

export default function FacebookCallbackPage() {
    return (
        <div className="min-h-[100dvh] flex items-center justify-center bg-muted p-4">
            <Card className="w-full max-w-[350px] p-6 sm:p-12">
                <CardHeader>
                    <svg
                        className="mx-auto size-12 text-[#1877F2] mb-4"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                    >
                        <title>Facebook</title>
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                    <CardTitle className="text-center">
                        Facebook prijava
                    </CardTitle>
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
                                Prijava u tijeku...
                            </Typography>
                        </Row>
                        <Typography level="body3" center>
                            Pričekaj dok završimo tvoju Facebook prijavu.
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
