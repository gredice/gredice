'use client';

import { getBrowserGrediceAppOrigin } from '@gredice/client';
import { Alert } from '@gredice/ui/Alert';
import {
    FacebookLoginButton,
    GoogleLoginButton,
    useLastLoginProvider,
} from '@gredice/ui/auth';
import { Button } from '@gredice/ui/Button';
import { Card, CardContent } from '@gredice/ui/Card';
import { Input } from '@gredice/ui/Input';
import { Mail, Truck, Warning } from '@gredice/ui/icons';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useRouter } from 'next/navigation';
import { useActionState, useCallback, useState } from 'react';

export function LoginPanel() {
    const router = useRouter();
    const [emailExpanded, setEmailExpanded] = useState(false);
    const fetchLastLogin = useCallback(
        () => fetch('/api/gredice/api/auth/last-login'),
        [],
    );
    const lastLoginProvider = useLastLoginProvider(fetchLastLogin);
    const [error, submitAction, isPending] = useActionState<
        string | null,
        FormData
    >(async (_previous, formData) => {
        const email = formData.get('email');
        const password = formData.get('password');
        if (typeof email !== 'string' || typeof password !== 'string') {
            return 'Unesi email i zaporku.';
        }
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            if (!response.ok) {
                return 'Prijava nije uspjela. Provjeri podatke i pokušaj ponovno.';
            }
            router.refresh();
            return null;
        } catch {
            return 'Aplikacija za prijavu trenutačno nije dostupna.';
        }
    }, null);

    const oauth = (provider: 'google' | 'facebook') => {
        const callbackPath =
            provider === 'google'
                ? '/prijava/google-prijava/povratak'
                : '/prijava/facebook-prijava/povratak';
        const authUrl = new URL(
            `/api/auth/${provider}`,
            getBrowserGrediceAppOrigin('api'),
        );
        authUrl.searchParams.set(
            'redirect',
            `${window.location.origin}${callbackPath}`,
        );
        window.location.href = authUrl.toString();
    };

    return (
        <main className="relative flex min-h-[100dvh] w-full items-center justify-center overflow-hidden bg-background p-4">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,hsl(var(--primary)/0.18),transparent_42%),radial-gradient(circle_at_85%_80%,hsl(var(--secondary)/0.32),transparent_40%)]" />
            <Card className="relative w-full max-w-md shadow-xl">
                <CardContent noHeader className="p-6 sm:p-8">
                    <Stack spacing={6}>
                        <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                            <Truck className="size-6" />
                        </div>
                        <Stack spacing={1}>
                            <Typography level="h2" semiBold>
                                Gredice dostava
                            </Typography>
                            <Typography className="text-muted-foreground">
                                Prati svoju dostavu ili otvori vozačku rutu.
                            </Typography>
                        </Stack>
                        {!emailExpanded ? (
                            <Stack spacing={2}>
                                <GoogleLoginButton
                                    onClick={() => oauth('google')}
                                    lastUsed={lastLoginProvider === 'google'}
                                >
                                    Google prijava
                                </GoogleLoginButton>
                                <FacebookLoginButton
                                    onClick={() => oauth('facebook')}
                                    lastUsed={lastLoginProvider === 'facebook'}
                                >
                                    Facebook prijava
                                </FacebookLoginButton>
                                <Button
                                    variant="outlined"
                                    color="neutral"
                                    fullWidth
                                    startDecorator={<Mail className="size-4" />}
                                    onClick={() => setEmailExpanded(true)}
                                >
                                    Email prijava
                                </Button>
                            </Stack>
                        ) : (
                            <form action={submitAction} className="space-y-4">
                                <Input
                                    name="email"
                                    label="Email"
                                    type="email"
                                    autoComplete="email"
                                    fullWidth
                                    required
                                />
                                <Input
                                    name="password"
                                    label="Zaporka"
                                    type="password"
                                    autoComplete="current-password"
                                    fullWidth
                                    required
                                />
                                <Button
                                    type="submit"
                                    loading={isPending}
                                    fullWidth
                                >
                                    Prijavi se
                                </Button>
                                {error ? (
                                    <Alert
                                        color="danger"
                                        startDecorator={
                                            <Warning className="size-5" />
                                        }
                                    >
                                        {error}
                                    </Alert>
                                ) : null}
                            </form>
                        )}
                    </Stack>
                </CardContent>
            </Card>
        </main>
    );
}
