'use client';

import { Alert } from '@gredice/ui/Alert';
import {
    authCurrentUserQueryKeys,
    FacebookLoginButton,
    GoogleLoginButton,
    useLastLoginProvider,
} from '@gredice/ui/auth';
import { Button } from '@gredice/ui/Button';
import { Input } from '@gredice/ui/Input';
import { Mail, Warning } from '@gredice/ui/icons';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { usePostHog } from '@posthog/next';
import { useRouter } from 'next/navigation';
import { useActionState, useCallback, useState } from 'react';
import { queryClient } from '../providers/ClientAppProvider';
import { FarmSignInShell } from './FarmSignInShell';

type OAuthProvider = 'google' | 'facebook';

export function LoginDialog() {
    const posthog = usePostHog();
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
    >(async (_previousState, formData) => {
        const email = formData.get('email');
        const password = formData.get('password');

        if (typeof email !== 'string' || typeof password !== 'string') {
            return 'Unesi korisničko ime i zaporku.';
        }

        try {
            posthog?.capture('user_login_started', {
                provider: 'password',
                surface: 'farm',
            });
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });

            if (!response.ok) {
                posthog?.capture('user_login_failed', {
                    provider: 'password',
                    reason: 'invalid_credentials_or_access',
                    status: response.status,
                    surface: 'farm',
                });
                console.error('Login failed with status', response.status);
                return 'Prijava nije uspjela. Provjeri podatke i pokušaj ponovno.';
            }

            // Tokens are now in httpOnly cookies set by the API
            // No need to store them in localStorage
            await response.json();

            const currentUserResponse = await fetch(
                '/api/users/current-claims',
            );
            if (!currentUserResponse.ok) {
                posthog?.capture('user_login_failed', {
                    provider: 'password',
                    reason: 'no_farm_access',
                    status: currentUserResponse.status,
                    surface: 'farm',
                });
                return 'Tvoj korisnički račun nema pristup Gredice farmi.';
            }

            await queryClient.invalidateQueries({
                queryKey: authCurrentUserQueryKeys,
            });
            router.refresh();
            return null;
        } catch (cause) {
            posthog?.capture('user_login_failed', {
                provider: 'password',
                reason: 'unexpected_error',
                surface: 'farm',
            });
            console.error('Login request failed', cause);
            return 'Dogodila se neočekivana greška. Pokušaj ponovno kasnije.';
        }
    }, null);
    const handleOAuthLogin = (provider: OAuthProvider) => {
        posthog?.capture('user_oauth_started', {
            provider,
            surface: 'farm',
        });
        const callbackPath =
            provider === 'google'
                ? '/prijava/google-prijava/povratak'
                : '/prijava/facebook-prijava/povratak';
        const redirectUrl = `${window.location.origin}${callbackPath}`;
        // Use proxy path instead of direct API URL
        const authUrl = new URL(
            `/api/gredice/api/auth/${provider}`,
            window.location.origin,
        );
        authUrl.searchParams.set('redirect', redirectUrl);
        window.location.href = authUrl.toString();
    };

    return (
        <FarmSignInShell>
            <Stack spacing={7}>
                <Stack spacing={2}>
                    <Typography level="h2" className="text-xl" semiBold>
                        Dobrodošli
                    </Typography>
                    <Typography className="text-muted-foreground">
                        Prijavi se s Gredice računom kako bi upravljao svojom
                        farmom.
                    </Typography>
                </Stack>
                {!emailExpanded ? (
                    <Stack spacing={2}>
                        <GoogleLoginButton
                            aria-describedby={
                                lastLoginProvider === 'google'
                                    ? 'farm-google-last-used'
                                    : undefined
                            }
                            lastUsed={lastLoginProvider === 'google'}
                            onClick={() => handleOAuthLogin('google')}
                            size="lg"
                        >
                            Google prijava
                        </GoogleLoginButton>
                        {lastLoginProvider === 'google' ? (
                            <Typography
                                className="text-center text-xs text-muted-foreground sm:sr-only"
                                id="farm-google-last-used"
                                level="body3"
                            >
                                Zadnje korišteno
                            </Typography>
                        ) : null}
                        <FacebookLoginButton
                            aria-describedby={
                                lastLoginProvider === 'facebook'
                                    ? 'farm-facebook-last-used'
                                    : undefined
                            }
                            lastUsed={lastLoginProvider === 'facebook'}
                            onClick={() => handleOAuthLogin('facebook')}
                            size="lg"
                        >
                            Facebook prijava
                        </FacebookLoginButton>
                        {lastLoginProvider === 'facebook' ? (
                            <Typography
                                className="text-center text-xs text-muted-foreground sm:sr-only"
                                id="farm-facebook-last-used"
                                level="body3"
                            >
                                Zadnje korišteno
                            </Typography>
                        ) : null}
                        <Button
                            color="neutral"
                            fullWidth
                            onClick={() => setEmailExpanded(true)}
                            size="lg"
                            startDecorator={
                                <Mail
                                    aria-hidden="true"
                                    className="h-4 w-4 shrink-0"
                                />
                            }
                            type="button"
                            variant="outlined"
                        >
                            Email prijava
                        </Button>
                    </Stack>
                ) : (
                    <form action={submitAction} className="w-full space-y-4">
                        <Stack spacing={6}>
                            <Stack spacing={2}>
                                <Input
                                    autoComplete="email"
                                    className="h-11 [&>input]:h-full"
                                    fullWidth
                                    label="Email"
                                    name="email"
                                    placeholder="ime@primjer.com"
                                    required
                                    type="email"
                                />
                                <Input
                                    autoComplete="current-password"
                                    className="h-11 [&>input]:h-full"
                                    fullWidth
                                    label="Zaporka"
                                    name="password"
                                    required
                                    type="password"
                                />
                            </Stack>
                            <Button
                                fullWidth
                                loading={isPending}
                                size="lg"
                                type="submit"
                                variant="solid"
                            >
                                Prijavi se
                            </Button>
                            {error && (
                                <Alert
                                    color="danger"
                                    role="alert"
                                    startDecorator={
                                        <Warning
                                            aria-hidden="true"
                                            className="size-5"
                                        />
                                    }
                                >
                                    {error}
                                </Alert>
                            )}
                        </Stack>
                    </form>
                )}
            </Stack>
        </FarmSignInShell>
    );
}

export default LoginDialog;
