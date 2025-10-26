'use client';

import { client } from '@gredice/client';
import { FacebookLoginButton, GoogleLoginButton } from '@gredice/ui/auth';
import { Alert } from '@signalco/ui/Alert';
import { Divider } from '@signalco/ui-primitives/Divider';
import { Modal } from '@signalco/ui-primitives/Modal';
import { Stack } from '@signalco/ui-primitives/Stack';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@signalco/ui-primitives/Tabs';
import { useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { EmailPasswordForm } from './EmailPasswordForm';

export default function LoginModal() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [error, setError] = useState<string>();
    const [lastLoginProvider, setLastLoginProvider] = useState<string>();

    useEffect(() => {
        const token = localStorage.getItem('gredice-token');
        if (!token) return;
        client()
            .api.auth['last-login'].$get({ query: { token } })
            .then(async (response) => {
                if (response.status !== 200) return;
                const data = await response.json();
                if (data?.provider) setLastLoginProvider(data.provider);
            })
            .catch(() => {
                /* ignore */
            });
    }, []);

    const handleLogin = async (email: string, password: string) => {
        setError(undefined);
        const response = await client().api.auth.login.$post({
            json: {
                email,
                password,
            },
        });

        if (response.status === 200) {
            const { token } = await response.json();
            localStorage.setItem('gredice-token', token);
            await queryClient.invalidateQueries();
            return;
        } else {
            const json = await response.json();
            if ('errorCode' in json) {
                if (json.errorCode === 'verify_email') {
                    console.debug('User email not verified', email);
                    router.push(
                        `/prijava/potvrda-emaila/posalji?email=${email}`,
                    );
                    return;
                }
                if (
                    json.errorCode === 'user_blocked' &&
                    'blockedUntil' in json &&
                    json.blockedUntil &&
                    typeof json.blockedUntil === 'string'
                ) {
                    console.debug('User is blocked until', json.blockedUntil);
                    setError(
                        `Korisnik je blokiran do ${new Date(json.blockedUntil).toLocaleString('hr-HR')}. Pokušaj ponovno kasnije.`,
                    );
                    return;
                }
                if ('leftAttempts' in json) {
                    console.debug(
                        'Login failed with left attempts',
                        json.leftAttempts,
                    );
                    setError(
                        `Prijava nije uspjela. Preostalo pokušaja: ${json.leftAttempts}.`,
                    );
                    return;
                }
            }

            console.error('Login failed with status', response.status);
            setError('Prijava nije uspjela. Pokušaj ponovno.');
            return;
        }
    };

    const handleRegister = async (email: string, password: string) => {
        setError(undefined);
        const response = await client().api.auth.register.$post({
            json: {
                email,
                password,
            },
        });

        if (response.status !== 201) {
            console.error('Registration failed with status', response.status);
            setError('Registracija nije uspjela. Pokušaj ponovno.');
            return;
        }

        router.push('/prijava/registracija-uspijesna');
    };

    const handleOAuthLogin = (provider: 'google' | 'facebook') => {
        window.location.href = `https://api.gredice.com/api/auth/${provider}`;
    };

    return (
        <Modal
            open
            title="Prijava"
            className="bg-card border-tertiary border-b-4 rounded-lg shadow-2xl"
            dismissible={false}
        >
            <Tabs defaultValue="login" className="w-full">
                <div className="flex justify-center w-full">
                    <TabsList className="grid grid-cols-2">
                        <TabsTrigger value="login">Prijava</TabsTrigger>
                        <TabsTrigger value="register">Registracija</TabsTrigger>
                    </TabsList>
                </div>
                <Stack spacing={2}>
                    <TabsContent value="login" className="mt-4">
                        <div className="space-y-4 px-1">
                            <Stack spacing={2}>
                                <EmailPasswordForm
                                    onSubmit={handleLogin}
                                    submitText="Prijava"
                                />
                                {error && <Alert color="danger">{error}</Alert>}
                            </Stack>
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
                        </div>
                    </TabsContent>
                    <TabsContent value="register" className="mt-4">
                        <div className="space-y-4 px-1">
                            <Stack spacing={2}>
                                <EmailPasswordForm
                                    onSubmit={handleRegister}
                                    submitText="Registriraj se"
                                    registration
                                />
                                {error && <Alert color="danger">{error}</Alert>}
                            </Stack>
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
                        </div>
                    </TabsContent>
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
            </Tabs>
        </Modal>
    );
}
