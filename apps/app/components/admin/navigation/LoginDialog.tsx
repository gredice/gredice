'use client';

import {
    FacebookLoginButton,
    GoogleLoginButton,
    useLastLoginProvider,
} from '@gredice/ui/auth';
import { authCurrentUserQueryKeys } from '@signalco/auth-client';
import { Alert } from '@signalco/ui/Alert';
import { Warning } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { Divider } from '@signalco/ui-primitives/Divider';
import { Input } from '@signalco/ui-primitives/Input';
import { Modal } from '@signalco/ui-primitives/Modal';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useActionState, useCallback } from 'react';
import { invalidatePage } from '../../../app/(actions)/sharedActions';
import { queryClient } from '../../providers/ClientAppProvider';

export function LoginDialog() {
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
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });
            if (response.status !== 200) {
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
        const callbackPath =
            provider === 'google'
                ? '/prijava/google-prijava/povratak'
                : '/prijava/facebook-prijava/povratak';
        const redirectUrl = `${window.location.origin}${callbackPath}`;
        const authUrl = new URL(
            `/api/gredice/api/auth/${provider}`,
            window.location.origin,
        );
        authUrl.searchParams.set('redirect', redirectUrl);
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
                <Stack spacing={4}>
                    <Typography level="h4" component="p">
                        Prijava
                    </Typography>
                    <form action={submitAction}>
                        <Stack spacing={4}>
                            <Stack spacing={1}>
                                <Input
                                    name="email"
                                    label="Email"
                                    placeholder="email@email.com"
                                    type="email"
                                    autoComplete="email"
                                />
                                <Input
                                    name="password"
                                    label="Zaporka"
                                    type="password"
                                    autoComplete="current-password"
                                />
                            </Stack>
                            <Button
                                type="submit"
                                loading={isPending}
                                variant="solid"
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
                    <Stack spacing={2}>
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <Divider />
                            </div>
                            <div className="relative flex justify-center">
                                <span className="bg-background px-2 text-xs rounded-sm">
                                    ili nastavi sa
                                </span>
                            </div>
                        </div>
                        <Stack spacing={1}>
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
