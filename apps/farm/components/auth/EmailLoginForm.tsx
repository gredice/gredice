'use client';

import { getBrowserGrediceAppOrigin } from '@gredice/client';
import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { Input } from '@gredice/ui/Input';
import { ArrowLeft, Warning } from '@gredice/ui/icons';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import type { FarmLoginErrorCode } from '../../lib/auth/farmLoginContract';

const EMAIL_INPUT_ID = 'farm-email-login-email';

const ERROR_CONTENT: Record<
    FarmLoginErrorCode,
    { message: string; title: string }
> = {
    email_verification_required: {
        title: 'Potvrdi email prije prijave',
        message:
            'Otvori poruku za potvrdu računa ili zatraži novu poveznicu pa se ponovno prijavi.',
    },
    invalid_credentials: {
        title: 'Email ili zaporka nisu ispravni',
        message:
            'Provjeri unesene podatke ili obnovi zaporku. Iz sigurnosnih razloga ne možemo navesti koji podatak nije ispravan.',
    },
    invalid_request: {
        title: 'Provjeri unesene podatke',
        message: 'Unesi valjanu email adresu i zaporku pa pokušaj ponovno.',
    },
    no_farm_access: {
        title: 'Račun nema pristup Farmi',
        message:
            'Ovaj Gredice račun nije povezan s farmom koju možeš voditi. Podrška može provjeriti tvoj pristup.',
    },
    service_unavailable: {
        title: 'Prijava trenutačno nije dostupna',
        message:
            'Provjeri internetsku vezu i pokušaj ponovno za nekoliko trenutaka. Uneseni podaci ostaju u obrascu.',
    },
    temporarily_locked: {
        title: 'Prijava je privremeno zaključana',
        message:
            'Pričekaj prije novog pokušaja ili obnovi zaporku. Ne možemo prikazati sigurnosne pojedinosti zaključavanja.',
    },
};

export type FarmLoginFailure = {
    attempt: number;
    code: FarmLoginErrorCode;
};

interface EmailLoginFormProps {
    failure: FarmLoginFailure | null;
    loading: boolean;
    onBack: () => void;
    onSubmit: (email: string, password: string) => Promise<void>;
}

function createRecoveryUrl(pathname: string, email: string) {
    const url = new URL(pathname, getBrowserGrediceAppOrigin('garden'));
    if (email) {
        url.searchParams.set('email', email);
    }
    return url.toString();
}

export function EmailLoginForm({
    failure,
    loading,
    onBack,
    onSubmit,
}: EmailLoginFormProps) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [passwordVisible, setPasswordVisible] = useState(false);
    const errorRef = useRef<HTMLDivElement>(null);
    const passwordResetUrl = createRecoveryUrl(
        '/prijava/zaboravljena-zaporka',
        email,
    );
    const verificationUrl = createRecoveryUrl(
        '/prijava/potvrda-emaila/posalji',
        email,
    );
    const supportUrl = new URL(
        '/kontakt',
        getBrowserGrediceAppOrigin('www'),
    ).toString();

    useEffect(() => {
        document.getElementById(EMAIL_INPUT_ID)?.focus();
    }, []);

    useEffect(() => {
        if (failure) {
            errorRef.current?.focus();
        }
    }, [failure]);

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!loading) {
            void onSubmit(email, password);
        }
    }

    return (
        <form
            className="w-full min-w-0 space-y-5"
            data-farm-email-login-form
            onSubmit={handleSubmit}
        >
            <Button
                color="neutral"
                disabled={loading}
                fullWidth
                onClick={onBack}
                size="lg"
                startDecorator={
                    <ArrowLeft aria-hidden="true" className="size-4" />
                }
                type="button"
                variant="plain"
            >
                Natrag na druge načine prijave
            </Button>

            <Stack spacing={2}>
                <Typography className="text-lg" level="h3" semiBold>
                    Email prijava
                </Typography>
                <Typography className="text-muted-foreground" level="body2">
                    Unesi podatke svog Gredice računa.
                </Typography>
            </Stack>

            <Stack spacing={3}>
                <Input
                    autoCapitalize="none"
                    autoComplete="email"
                    className="h-11 [&>input]:h-full"
                    disabled={loading}
                    enterKeyHint="next"
                    fullWidth
                    id={EMAIL_INPUT_ID}
                    inputMode="email"
                    label="Email"
                    name="email"
                    onChange={(event) => setEmail(event.currentTarget.value)}
                    placeholder="ime@primjer.com"
                    required
                    spellCheck={false}
                    style={{ fontSize: '16px' }}
                    type="email"
                    value={email}
                />
                <Input
                    autoComplete="current-password"
                    className="h-11 [&>input]:h-full"
                    disabled={loading}
                    endDecorator={
                        <button
                            aria-label={
                                passwordVisible
                                    ? 'Sakrij zaporku'
                                    : 'Prikaži zaporku'
                            }
                            aria-pressed={passwordVisible}
                            className="min-h-11 min-w-11 shrink-0 rounded-r-md px-3 text-sm font-medium text-primary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                            disabled={loading}
                            onClick={() =>
                                setPasswordVisible((visible) => !visible)
                            }
                            type="button"
                        >
                            {passwordVisible ? 'Sakrij' : 'Prikaži'}
                        </button>
                    }
                    enterKeyHint="go"
                    fullWidth
                    id="farm-email-login-password"
                    label="Zaporka"
                    name="password"
                    onChange={(event) => setPassword(event.currentTarget.value)}
                    required
                    style={{ fontSize: '16px' }}
                    type={passwordVisible ? 'text' : 'password'}
                    value={password}
                />
            </Stack>

            <Button
                className="min-h-11 px-3"
                color="neutral"
                disabled={loading}
                fullWidth
                href={passwordResetUrl}
                size="lg"
                variant="link"
            >
                Zaboravljena zaporka?
            </Button>

            {failure ? (
                <div
                    className="rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    data-farm-email-error
                    ref={errorRef}
                    tabIndex={-1}
                >
                    <Alert
                        color="danger"
                        role="alert"
                        startDecorator={
                            <Warning aria-hidden="true" className="size-5" />
                        }
                    >
                        <Stack spacing={2}>
                            <Stack spacing={1}>
                                <Typography level="body2" semiBold>
                                    {ERROR_CONTENT[failure.code].title}
                                </Typography>
                                <Typography level="body2">
                                    {ERROR_CONTENT[failure.code].message}
                                </Typography>
                            </Stack>
                            {failure.code === 'email_verification_required' ? (
                                <Button
                                    className="min-h-11 px-3"
                                    color="danger"
                                    disabled={loading}
                                    fullWidth
                                    href={verificationUrl}
                                    size="lg"
                                    variant="outlined"
                                >
                                    Pošalji novu potvrdu emaila
                                </Button>
                            ) : null}
                        </Stack>
                    </Alert>
                </div>
            ) : null}

            <Button
                fullWidth
                loading={loading}
                size="lg"
                type="submit"
                variant="solid"
            >
                Prijavi se
            </Button>

            <Button
                className="min-h-11 px-3"
                color="neutral"
                disabled={loading}
                fullWidth
                href={supportUrl}
                size="lg"
                variant="link"
            >
                Trebaš pomoć? Kontaktiraj podršku
            </Button>
        </form>
    );
}
