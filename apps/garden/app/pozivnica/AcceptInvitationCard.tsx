'use client';

import { client } from '@gredice/client';
import { Button } from '@signalco/ui-primitives/Button';
import { Card } from '@signalco/ui-primitives/Card';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

export function AcceptInvitationCard() {
    const searchParams = useSearchParams();
    const token = searchParams.get('token');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<string | null>(null);

    async function handleAccept() {
        if (!token) {
            setResult('Nevažeća ili istekla poveznica.');
            return;
        }

        setLoading(true);
        try {
            const res =
                await client().api.accounts.invitations.accept.$post({
                    json: { token },
                });

            if (res.ok) {
                setResult(
                    'Pozivnica je uspješno prihvaćena! Sada možeš pristupiti zajedničkom računu.',
                );
            } else {
                setResult(
                    'Pozivnica je nevažeća ili istekla. Zatraži novu pozivnicu.',
                );
            }
        } catch {
            setResult('Došlo je do greške. Pokušaj ponovno kasnije.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <Card className="max-w-md mx-auto mt-10 p-6 text-center bg-background">
            <Stack spacing={4} alignItems="center">
                <Typography level="h5" semiBold>
                    Pozivnica za pridruživanje
                </Typography>
                {result ? (
                    <Typography level="body1">{result}</Typography>
                ) : (
                    <>
                        <Typography level="body1">
                            Klikom na gumb ispod prihvaćaš pozivnicu za
                            pridruživanje zajedničkom računu.
                        </Typography>
                        <Button
                            variant="solid"
                            onClick={handleAccept}
                            disabled={loading || !token}
                            loading={loading}
                        >
                            {loading
                                ? 'Prihvaćanje...'
                                : 'Prihvati pozivnicu'}
                        </Button>
                    </>
                )}
            </Stack>
        </Card>
    );
}
