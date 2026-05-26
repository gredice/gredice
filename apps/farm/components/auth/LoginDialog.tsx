'use client';

import { Alert } from '@gredice/ui/Alert';
import {
    authCurrentUserQueryKeys,
    FacebookLoginButton,
    GoogleLoginButton,
    useLastLoginProvider,
} from '@gredice/ui/auth';
import { Button } from '@gredice/ui/Button';
import { Divider } from '@gredice/ui/Divider';
import { Input } from '@gredice/ui/Input';
import { Warning } from '@gredice/ui/icons';
import { Modal } from '@gredice/ui/Modal';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { usePostHog } from '@posthog/next';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useActionState, useCallback } from 'react';
import { queryClient } from '../providers/ClientAppProvider';

type OAuthProvider = 'google' | 'facebook';

export function LoginDialog() {
    const posthog = usePostHog();
    const router = useRouter();
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
        <div className="min-h-[100dvh] flex items-center justify-center bg-gradient-to-br from-primary/10 via-transparent to-success/10 p-4">
            <Image
                src="/login-bg.webp"
                alt="Pozadina"
                fill
                className="object-cover"
                quality={100}
                priority
            />
            <Modal
                open
                dismissible={false}
                title="Prijava u Gredice farmu"
                className="md:max-w-md"
            >
                <Stack spacing={8}>
                    <Stack spacing={2}>
                        <Typography level="h3" className="text-2xl" semiBold>
                            Dobrodošli
                        </Typography>
                        <Typography className="text-muted-foreground">
                            Prijavi se s Gredice računom kako bi upravljao
                            svojom farmom.
                        </Typography>
                    </Stack>
                    <form action={submitAction} className="w-full space-y-4">
                        <Stack spacing={6}>
                            <Stack spacing={2}>
                                <Input
                                    name="email"
                                    label="Email"
                                    placeholder="ime@primjer.com"
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
                            </Stack>
                            <Button
                                type="submit"
                                loading={isPending}
                                variant="solid"
                                fullWidth
                            >
                                Prijavi se
                            </Button>
                            {error && (
                                <Alert
                                    color="danger"
                                    startDecorator={
                                        <Warning className="size-5" />
                                    }
                                >
                                    {error}
                                </Alert>
                            )}
                        </Stack>
                    </form>
                    <Stack spacing={4}>
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <Divider />
                            </div>
                            <div className="relative flex justify-center">
                                <span className="bg-background px-2 text-xs rounded-xs">
                                    ili nastavi sa
                                </span>
                            </div>
                        </div>
                        <Stack spacing={2}>
                            <FacebookLoginButton
                                onClick={() => handleOAuthLogin('facebook')}
                                lastUsed={lastLoginProvider === 'facebook'}
                            />
                            <GoogleLoginButton
                                onClick={() => handleOAuthLogin('google')}
                                lastUsed={lastLoginProvider === 'google'}
                            />
                        </Stack>
                    </Stack>
                </Stack>
            </Modal>
        </div>
    );
}

export default LoginDialog;
