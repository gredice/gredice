'use client';

import { getBrowserGrediceAppOrigin } from '@gredice/client';
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
import { useActionState, useCallback } from 'react';
import { invalidatePage } from '../../../app/(actions)/sharedActions';
import { queryClient } from '../../providers/ClientAppProvider';

export function LoginDialog() {
    const posthog = usePostHog();
    const fetchLastLogin = useCallback(
        () => fetch('/api/gredice/api/auth/last-login'),
        [],
    );
    const lastLoginProvider = useLastLoginProvider(fetchLastLogin);
    const [error, submitAction, isPending] = useActionState(
        async (_previousState: unknown, formData: FormData) => {
            const emailValue = formData.get('email');
            const passwordValue = formData.get('password');
            if (
                typeof emailValue !== 'string' ||
                typeof passwordValue !== 'string'
            ) {
                return { error: true };
            }
            const email = emailValue;
            const password = passwordValue;

            // Send the form data to the server
            posthog?.capture('user_login_started', {
                provider: 'password',
                surface: 'app_admin',
            });
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });
            if (response.status !== 200) {
                posthog?.capture('user_login_failed', {
                    provider: 'password',
                    reason: 'invalid_credentials_or_access',
                    status: response.status,
                    surface: 'app_admin',
                });
                console.error('Login failed with status', response.status);
                return { error: true };
            }

            await response.json();

            await queryClient.invalidateQueries({
                queryKey: authCurrentUserQueryKeys,
            });
            await invalidatePage();
        },
        null,
    );

    const handleOAuthLogin = (provider: 'google' | 'facebook') => {
        posthog?.capture('user_oauth_started', {
            provider,
            surface: 'app_admin',
        });
        const callbackPath =
            provider === 'google'
                ? '/prijava/google-prijava/povratak'
                : '/prijava/facebook-prijava/povratak';
        const redirectUrl = `${window.location.origin}${callbackPath}`;
        const apiBaseUrl = getBrowserGrediceAppOrigin('api');
        const authUrl = new URL(`/api/auth/${provider}`, apiBaseUrl);
        authUrl.searchParams.set('redirect', redirectUrl);
        authUrl.searchParams.set(
            'timeZone',
            Intl.DateTimeFormat().resolvedOptions().timeZone,
        );
        window.location.href = authUrl.toString();
    };

    return (
        <div className="h-[100vh] flex items-center justify-center">
            <Modal
                open
                dismissible={false}
                title="Prijava"
                className="md:max-w-md"
            >
                <Stack spacing={8}>
                    <Typography level="h4" component="p">
                        Prijava
                    </Typography>
                    <form action={submitAction} className="w-full">
                        <Stack spacing={8}>
                            <Stack spacing={2}>
                                <Input
                                    name="email"
                                    label="Email"
                                    placeholder="email@email.com"
                                    type="email"
                                    autoComplete="email"
                                    fullWidth
                                />
                                <Input
                                    name="password"
                                    label="Zaporka"
                                    type="password"
                                    autoComplete="current-password"
                                    fullWidth
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
                                    startDecorator={<Warning />}
                                >
                                    Greška prilikom prijave. Pokušajte ponovo.
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
