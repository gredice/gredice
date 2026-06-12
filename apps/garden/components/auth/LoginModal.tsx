'use client';

import { clientPublic, getBrowserGrediceAppOrigin } from '@gredice/client';
import { Alert } from '@gredice/ui/Alert';
import {
    FacebookLoginButton,
    GoogleLoginButton,
    useLastLoginProvider,
} from '@gredice/ui/auth';
import { Button } from '@gredice/ui/Button';
import { Mail } from '@gredice/ui/icons';
import { Modal } from '@gredice/ui/Modal';
import { Stack } from '@gredice/ui/Stack';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@gredice/ui/Tabs';
import { usePostHog } from '@posthog/next';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { EmailPasswordForm } from './EmailPasswordForm';
import LoginBanner from './LoginBanner';

type AuthTab = 'login' | 'register';

export default function LoginModal() {
    const posthog = usePostHog();
    const router = useRouter();
    const queryClient = useQueryClient();
    const [error, setError] = useState<string>();
    const [activeTab, setActiveTab] = useState<AuthTab>('login');
    const [emailExpanded, setEmailExpanded] = useState(false);
    const fetchLastLogin = useCallback(
        () => clientPublic().api.auth['last-login'].$get(),
        [],
    );
    const lastLoginProvider = useLastLoginProvider(fetchLastLogin);

    const handleLogin = async (email: string, password: string) => {
        setError(undefined);
        posthog?.capture('user_login_started', {
            provider: 'password',
            surface: 'garden',
        });
        const response = await clientPublic().api.auth.login.$post({
            json: {
                email,
                password,
            },
        });

        if (response.status === 200) {
            await response.json();
            await queryClient.invalidateQueries();
            return;
        } else {
            const json = await response.json();
            if ('errorCode' in json) {
                if (json.errorCode === 'verify_email') {
                    posthog?.capture('user_login_failed', {
                        provider: 'password',
                        reason: 'verify_email',
                        status: response.status,
                        surface: 'garden',
                    });
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
                    posthog?.capture('user_login_failed', {
                        provider: 'password',
                        reason: 'user_blocked',
                        status: response.status,
                        surface: 'garden',
                    });
                    console.debug('User is blocked until', json.blockedUntil);
                    setError(
                        `Korisnik je blokiran do ${new Date(json.blockedUntil).toLocaleString('hr-HR')}. Pokušaj ponovno kasnije.`,
                    );
                    return;
                }
                if ('leftAttempts' in json) {
                    posthog?.capture('user_login_failed', {
                        left_attempts: json.leftAttempts,
                        provider: 'password',
                        reason: 'invalid_credentials',
                        status: response.status,
                        surface: 'garden',
                    });
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

            posthog?.capture('user_login_failed', {
                provider: 'password',
                reason: 'unknown',
                status: response.status,
                surface: 'garden',
            });
            console.error('Login failed with status', response.status);
            setError('Prijava nije uspjela. Pokušaj ponovno.');
            return;
        }
    };

    const handleRegister = async (email: string, password: string) => {
        setError(undefined);
        posthog?.capture('user_signup_started', {
            provider: 'password',
            surface: 'garden',
        });
        const response = await clientPublic().api.auth.register.$post({
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
        posthog?.capture('user_oauth_started', {
            provider,
            surface: 'garden',
        });
        const authUrl = new URL(
            `/api/auth/${provider}`,
            getBrowserGrediceAppOrigin('api'),
        );
        window.location.href = authUrl.toString();
    };

    const handleTabChange = (value: string) => {
        if (value === 'login' || value === 'register') {
            setActiveTab(value);
            setEmailExpanded(false);
            setError(undefined);
        }
    };

    const emailButtonLabel =
        activeTab === 'login' ? 'Prijava emailom' : 'Registracija emailom';

    return (
        <>
            <LoginBanner />
            <Modal
                open
                title="Prijava"
                className="bg-card z-[60] border-tertiary border-b-4 rounded-lg shadow-2xl"
                dismissible={false}
            >
                <Tabs
                    value={activeTab}
                    onValueChange={handleTabChange}
                    className="w-full"
                >
                    <div className="flex justify-center w-full">
                        <TabsList className="grid grid-cols-2">
                            <TabsTrigger value="login">Prijava</TabsTrigger>
                            <TabsTrigger value="register">
                                Registracija
                            </TabsTrigger>
                        </TabsList>
                    </div>
                    <Stack spacing={4} className="mt-4">
                        {!emailExpanded && (
                            <Stack spacing={2}>
                                <GoogleLoginButton
                                    onClick={() => handleOAuthLogin('google')}
                                    lastUsed={lastLoginProvider === 'google'}
                                />
                                <FacebookLoginButton
                                    onClick={() => handleOAuthLogin('facebook')}
                                    lastUsed={lastLoginProvider === 'facebook'}
                                />
                                <Button
                                    type="button"
                                    variant="outlined"
                                    color="neutral"
                                    fullWidth
                                    startDecorator={
                                        <Mail className="h-4 w-4 shrink-0" />
                                    }
                                    onClick={() => setEmailExpanded(true)}
                                >
                                    {emailButtonLabel}
                                </Button>
                            </Stack>
                        )}
                        {emailExpanded && (
                            <>
                                <TabsContent value="login" className="mt-0">
                                    <div className="px-1">
                                        <Stack spacing={4}>
                                            <EmailPasswordForm
                                                onSubmit={handleLogin}
                                                submitText="Prijava"
                                            />
                                            {error && (
                                                <Alert color="danger">
                                                    {error}
                                                </Alert>
                                            )}
                                        </Stack>
                                    </div>
                                </TabsContent>
                                <TabsContent value="register" className="mt-0">
                                    <div className="px-1">
                                        <Stack spacing={4}>
                                            <EmailPasswordForm
                                                onSubmit={handleRegister}
                                                submitText="Registriraj se"
                                                registration
                                            />
                                            {error && (
                                                <Alert color="danger">
                                                    {error}
                                                </Alert>
                                            )}
                                        </Stack>
                                    </div>
                                </TabsContent>
                            </>
                        )}
                    </Stack>
                </Tabs>
            </Modal>
        </>
    );
}
