'use client';

import { client } from '@gredice/client';
import { SignedIn, SignedOut } from '@signalco/auth-client/components';
import { Button } from '@signalco/ui-primitives/Button';
import { Card } from '@signalco/ui-primitives/Card';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import Link from 'next/link';
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
            const res = await client().api.accounts.invitations.accept.$post({
                json: { token },
            });

            if (res.ok) {
                setResult(
                    'Pozivnica je uspješno prihvaćena! Sada možeš pristupiti zajedničkom računu.',
                );
            } else {
                let code: string | undefined;
                try {
                    const data = (await res.json()) as { code?: string };
                    code = data.code;
                } catch {
                    // ignore parse error
                }
                const messages: Record<string, string> = {
                    email_mismatch:
                        'Pozivnica je poslana na drugu email adresu. Prijavi se s ispravnim računom.',
                    invalid_invitation:
                        'Pozivnica je nevažeća ili istekla. Zatraži novu pozivnicu.',
                };
                setResult(
                    (code && messages[code]) ??
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
                <SignedOut>
                    <Typography level="body1">
                        Za prihvaćanje pozivnice potrebno je prijaviti se ili
                        stvoriti račun.
                    </Typography>
                    <Link href="/">
                        <Button variant="solid">
                            Prijavi se ili stvori račun
                        </Button>
                    </Link>
                    <Typography level="body3" className="text-muted-foreground">
                        Nakon prijave, otvori poveznicu iz emaila ponovo.
                    </Typography>
                </SignedOut>
                <SignedIn>
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
                </SignedIn>
            </Stack>
        </Card>
    );
}
