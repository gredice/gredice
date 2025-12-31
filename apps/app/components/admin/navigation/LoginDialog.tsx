'use client';

import { setStoredTokens } from '@gredice/client';
import { authCurrentUserQueryKeys } from '@signalco/auth-client';
import { Alert } from '@signalco/ui/Alert';
import { Warning } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { Input } from '@signalco/ui-primitives/Input';
import { Modal } from '@signalco/ui-primitives/Modal';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useActionState } from 'react';
import { invalidatePage } from '../../../app/(actions)/sharedActions';
import { queryClient } from '../../providers/ClientAppProvider';

export function LoginDialog() {
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

            const data: unknown = await response.json();
            if (typeof data === 'object' && data !== null) {
                const tokenValue = 'token' in data ? data.token : null;
                const refreshValue =
                    'refreshToken' in data ? data.refreshToken : null;
                if (typeof tokenValue === 'string') {
                    setStoredTokens({
                        accessToken: tokenValue,
                        refreshToken:
                            typeof refreshValue === 'string'
                                ? refreshValue
                                : null,
                    });
                }
            }

            await queryClient.invalidateQueries({
                queryKey: authCurrentUserQueryKeys,
            });
            await invalidatePage();
        },
        null,
    );

    return (
        <div className="h-[100vh] flex items-center justify-center">
            <Modal
                open
                dismissible={false}
                hideClose
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
                </Stack>
            </Modal>
        </div>
    );
}
