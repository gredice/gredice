'use client';

import { client } from '@gredice/client';
import { Alert } from '@signalco/ui/Alert';
import { Divider } from '@signalco/ui-primitives/Divider';
import { Modal } from '@signalco/ui-primitives/Modal';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@signalco/ui-primitives/Tabs';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { EmailPasswordForm } from './EmailPasswordForm';
import { FacebookLoginButton } from './FacebookLoginButton';
import { GoogleLoginButton } from './GoogleLoginButton';

export default function LoginModal() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [error, setError] = useState<string>();

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
            hideClose
            dismissible={false}
        >
            <Stack spacing={2}>
                <Row spacing={2} justifyContent="start">
                    <Image
                        src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/GrediceLogomark-v1LQ0bdzsonOf0SXkAUHj0h4G36mGB.svg"
                        alt="Gredice Logo"
                        width={48}
                        height={48}
                        priority
                        className="dark:mix-blend-plus-lighter"
                    />
                    <Typography
                        level="h3"
                        className="text-[#2f6e40] dark:mix-blend-plus-lighter"
                    >
                        Prijava
                    </Typography>
                </Row>
                <Tabs defaultValue="login" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 border">
                        <TabsTrigger value="login">Prijava</TabsTrigger>
                        <TabsTrigger value="register">Registracija</TabsTrigger>
                    </TabsList>
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
                            <Stack spacing={1}>
                                <FacebookLoginButton
                                    onClick={() => handleOAuthLogin('facebook')}
                                />
                                <GoogleLoginButton
                                    onClick={() => handleOAuthLogin('google')}
                                />
                            </Stack>
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
                            <Stack spacing={1}>
                                <FacebookLoginButton
                                    onClick={() => handleOAuthLogin('facebook')}
                                />
                                <GoogleLoginButton
                                    onClick={() => handleOAuthLogin('google')}
                                />
                            </Stack>
                        </div>
                    </TabsContent>
                </Tabs>
            </Stack>
        </Modal>
    );
}
