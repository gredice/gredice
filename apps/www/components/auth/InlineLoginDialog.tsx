'use client';

import { clientPublic } from '@gredice/client';
import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { Input } from '@gredice/ui/Input';
import { Mail } from '@gredice/ui/icons';
import { Modal } from '@gredice/ui/Modal';
import { Stack } from '@gredice/ui/Stack';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@gredice/ui/Tabs';
import { Typography } from '@gredice/ui/Typography';
import { useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useEffect, useState } from 'react';
import { currentUserQueryKey } from '../../hooks/useCurrentUser';

type AuthTab = 'login' | 'register';

type InlineLoginDialogProps = {
    description?: string;
    onAuthenticated?: () => void;
    onOpenChange: (open: boolean) => void;
    open: boolean;
};

function responseMessage(value: unknown, fallback: string) {
    if (
        typeof value === 'object' &&
        value !== null &&
        'error' in value &&
        typeof value.error === 'string'
    ) {
        return value.error;
    }

    return fallback;
}

function EmailPasswordForm({
    loading,
    onSubmit,
    registration = false,
    submitText,
}: {
    loading: boolean;
    onSubmit: (email: string, password: string) => void;
    registration?: boolean;
    submitText: string;
}) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [repeatPassword, setRepeatPassword] = useState('');
    const passwordsMatch = password === repeatPassword;

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (registration && !passwordsMatch) {
            return;
        }

        onSubmit(email, password);
    }

    return (
        <form className="flex w-full flex-col gap-5" onSubmit={handleSubmit}>
            <Stack spacing={2}>
                <Input
                    autoComplete="email"
                    fullWidth
                    id="inline-login-email"
                    label="Email"
                    onChange={(event) => setEmail(event.currentTarget.value)}
                    required
                    type="email"
                    value={email}
                />
                <Input
                    autoComplete={
                        registration ? 'new-password' : 'current-password'
                    }
                    fullWidth
                    id="inline-login-password"
                    label="Zaporka"
                    onChange={(event) => setPassword(event.currentTarget.value)}
                    required
                    type="password"
                    value={password}
                />
                {registration ? (
                    <Stack spacing={1}>
                        <Input
                            autoComplete="new-password"
                            fullWidth
                            id="inline-login-repeat-password"
                            label="Ponovi zaporku"
                            onChange={(event) =>
                                setRepeatPassword(event.currentTarget.value)
                            }
                            required
                            type="password"
                            value={repeatPassword}
                        />
                        {repeatPassword && !passwordsMatch ? (
                            <Typography level="body3" className="text-red-700">
                                Zaporke se ne podudaraju.
                            </Typography>
                        ) : null}
                    </Stack>
                ) : null}
            </Stack>
            <Button
                disabled={
                    loading ||
                    (registration &&
                        (!password.length ||
                            !repeatPassword.length ||
                            !passwordsMatch))
                }
                fullWidth
                loading={loading}
                startDecorator={<Mail className="size-4" />}
                type="submit"
                variant="soft"
            >
                {submitText}
            </Button>
        </form>
    );
}

export function InlineLoginDialog({
    description = 'Prijavi se i nastavi tamo gdje si stao.',
    onAuthenticated,
    onOpenChange,
    open,
}: InlineLoginDialogProps) {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<AuthTab>('login');
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [registrationSent, setRegistrationSent] = useState(false);

    useEffect(() => {
        if (!open) {
            setError(null);
            setRegistrationSent(false);
            setActiveTab('login');
        }
    }, [open]);

    function handleTabChange(value: string) {
        if (value === 'login' || value === 'register') {
            setActiveTab(value);
            setError(null);
            setRegistrationSent(false);
        }
    }

    async function handleLogin(email: string, password: string) {
        setIsSubmitting(true);
        setError(null);

        try {
            const response = await clientPublic().api.auth.login.$post({
                json: { email, password },
            });

            if (response.ok) {
                await queryClient.invalidateQueries({
                    queryKey: currentUserQueryKey,
                });
                onOpenChange(false);
                onAuthenticated?.();
                return;
            }

            const body: unknown = await response.json().catch(() => null);
            setError(
                responseMessage(
                    body,
                    response.status === 403
                        ? 'Potvrdi email prije prijave.'
                        : 'Prijava nije uspjela. Provjeri email i zaporku.',
                ),
            );
        } finally {
            setIsSubmitting(false);
        }
    }

    async function handleRegister(email: string, password: string) {
        setIsSubmitting(true);
        setError(null);
        setRegistrationSent(false);

        try {
            const response = await clientPublic().api.auth.register.$post({
                json: { email, password },
            });

            if (response.status === 201) {
                setRegistrationSent(true);
                return;
            }

            const body: unknown = await response.json().catch(() => null);
            setError(
                responseMessage(
                    body,
                    'Registracija nije uspjela. Pokušaj ponovno.',
                ),
            );
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <Modal
            className="max-w-md rounded-lg border-tertiary border-b-4 bg-card shadow-2xl"
            description={description}
            onOpenChange={onOpenChange}
            open={open}
            title="Prijava"
        >
            <Stack spacing={4}>
                <Stack spacing={1}>
                    <Typography level="h3">Prijava u Gredice</Typography>
                    <Typography level="body2" secondary>
                        {description}
                    </Typography>
                </Stack>

                <Tabs
                    className="w-full"
                    onValueChange={handleTabChange}
                    value={activeTab}
                >
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="login">Prijava</TabsTrigger>
                        <TabsTrigger value="register">Registracija</TabsTrigger>
                    </TabsList>

                    <Stack spacing={4} className="mt-4">
                        <TabsContent className="mt-0" value="login">
                            <EmailPasswordForm
                                loading={isSubmitting}
                                onSubmit={handleLogin}
                                submitText="Prijavi se"
                            />
                        </TabsContent>
                        <TabsContent className="mt-0" value="register">
                            <EmailPasswordForm
                                loading={isSubmitting}
                                onSubmit={handleRegister}
                                registration
                                submitText="Registriraj se"
                            />
                        </TabsContent>

                        {registrationSent ? (
                            <Alert color="success">
                                Poslali smo ti email za potvrdu računa. Nakon
                                potvrde se prijavi ovdje i nastavi.
                            </Alert>
                        ) : null}
                        {error ? <Alert color="danger">{error}</Alert> : null}
                    </Stack>
                </Tabs>
            </Stack>
        </Modal>
    );
}
