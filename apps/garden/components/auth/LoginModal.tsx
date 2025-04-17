'use client';

import Image from 'next/image'
import { Modal } from "@signalco/ui-primitives/Modal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@signalco/ui-primitives/Tabs";
import { EmailPasswordForm } from './EmailPasswordForm'
import { Typography } from '@signalco/ui-primitives/Typography';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { authCurrentUserQueryKeys } from "@signalco/auth-client";
import { useState } from 'react';
import { Alert } from '@signalco/ui/Alert';
import { apiFetch } from '../../lib/apiFetch';

export default function LoginModal() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [error, setError] = useState<string>();

    const handleLogin = async (email: string, password: string) => {
        setError(undefined);
        const response = await apiFetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        if (response.status === 403) {
            const { error } = await response.json();
            if (error === 'verify_email') {
                router.push(`/prijava/potvrda-emaila/posalji?email=${email}`);
                return;
            }
        }
        if (response.status !== 200) {
            console.error('Login failed with status', response.status);
            setError('Prijava nije uspjela. Pokušaj ponovno.');
            return;
        }

        const { token } = await response.json();
        localStorage.setItem('gredice-token', token);

        await queryClient.invalidateQueries({ queryKey: authCurrentUserQueryKeys });
    }

    const handleRegister = async (email: string, password: string) => {
        setError(undefined);
        const response = await apiFetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        if (response.status !== 201) {
            console.error('Registration failed with status', response.status);
            setError('Registracija nije uspjela. Pokušaj ponovno.');
            return;
        }

        router.push('/prijava/registracija-uspijesna');
    }

    return (
        <Modal
            open
            title="Prijava"
            className='bg-card max-w-md border-tertiary border-b-4'
            hideClose>
            <Stack spacing={2}>
                <Row spacing={2} justifyContent='start'>
                    <Image
                        src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/GrediceLogomark-v1LQ0bdzsonOf0SXkAUHj0h4G36mGB.svg"
                        alt="Gredice Logo"
                        width={48}
                        height={48}
                        priority
                        className='dark:mix-blend-plus-lighter'
                    />
                    <Typography level='h3' className='text-[#2f6e40] dark:mix-blend-plus-lighter'>Prijava</Typography>
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
                                {error && (
                                    <Alert color='danger'>
                                        {error}
                                    </Alert>
                                )}
                            </Stack>
                            {/* <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <Divider />
                                </div>
                                <div className="relative flex justify-center">
                                    <span className="bg-background px-2 text-xs opacity-60">
                                        ili nastavi sa
                                    </span>
                                </div>
                            </div>
                            <Link href="/prijava/facebook-prijava" legacyBehavior passHref>
                                <FacebookLoginButton />
                            </Link> */}
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
                                {error && (
                                    <Alert color='danger'>
                                        {error}
                                    </Alert>
                                )}
                            </Stack>
                            {/* <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <Divider />
                                </div>
                                <div className="relative flex justify-center">
                                    <span className="bg-background px-2 text-xs opacity-60">
                                        ili nastavi sa
                                    </span>
                                </div>
                            </div>
                            <Link href="/prijava/facebook-prijava" legacyBehavior passHref>
                                <FacebookLoginButton />
                            </Link> */}
                        </div>
                    </TabsContent>
                </Tabs>
            </Stack>
        </Modal>
    )
}

