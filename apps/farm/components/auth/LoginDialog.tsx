'use client';

import { authCurrentUserQueryKeys } from '@signalco/auth-client';
import { Alert } from '@signalco/ui/Alert';
import { Warning } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { Divider } from '@signalco/ui-primitives/Divider';
import { Input } from '@signalco/ui-primitives/Input';
import { Modal } from '@signalco/ui-primitives/Modal';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';
import { queryClient } from '../providers/ClientAppProvider';
import { FacebookLoginButton } from './FacebookLoginButton';
import { GoogleLoginButton } from './GoogleLoginButton';

type OAuthProvider = 'google' | 'facebook';

export function LoginDialog() {
    const router = useRouter();
    const [lastLoginProvider, setLastLoginProvider] = useState<OAuthProvider>();
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
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });

            if (!response.ok) {
                console.error('Login failed with status', response.status);
                return 'Prijava nije uspjela. Provjeri podatke i pokušaj ponovno.';
            }

            const { token } = (await response.json()) as { token?: string };
            if (token) {
                localStorage.setItem('gredice-token', token);
            }

            const currentUserResponse = await fetch('/api/users/current');
            if (!currentUserResponse.ok) {
                localStorage.removeItem('gredice-token');
                return 'Tvoj korisnički račun nema pristup Gredice farmi.';
            }

            await queryClient.invalidateQueries({
                queryKey: authCurrentUserQueryKeys,
            });
            router.refresh();
            return null;
        } catch (cause) {
            console.error('Login request failed', cause);
            return 'Dogodila se neočekivana greška. Pokušaj ponovno kasnije.';
        }
    }, null);

    useEffect(() => {
        const token = localStorage.getItem('gredice-token');
        if (!token) {
            return;
        }

        let isMounted = true;

        fetch(
            `https://api.gredice.com/api/auth/last-login?token=${encodeURIComponent(token)}`,
        )
            .then((response) => {
                if (!response.ok) {
                    return null;
                }

                return response.json() as Promise<{ provider?: string }>;
            })
            .then((data) => {
                if (!isMounted || !data) {
                    return;
                }

                if (
                    data.provider === 'google' ||
                    data.provider === 'facebook'
                ) {
                    setLastLoginProvider(data.provider);
                }
            })
            .catch(() => {
                /* ignore */
            });

        return () => {
            isMounted = false;
        };
    }, []);

    const handleOAuthLogin = (provider: OAuthProvider) => {
        window.location.href = `https://api.gredice.com/api/auth/${provider}`;
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
                hideClose
                title="Prijava u Gredice farmu"
                className="md:max-w-md"
            >
                <Stack spacing={4}>
                    <Stack spacing={1}>
                        <Typography level="h3" className="text-2xl" semiBold>
                            Dobrodošli
                        </Typography>
                        <Typography className="text-muted-foreground">
                            Prijavi se s Gredice računom kako bi upravljao
                            svojom farmom.
                        </Typography>
                    </Stack>
                    <form action={submitAction} className="space-y-4">
                        <Stack spacing={3}>
                            <Stack spacing={1}>
                                <Input
                                    name="email"
                                    label="Email"
                                    placeholder="ime@primjer.com"
                                    type="email"
                                    autoComplete="email"
                                    required
                                />
                                <Input
                                    name="password"
                                    label="Zaporka"
                                    type="password"
                                    autoComplete="current-password"
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

export default LoginDialog;
