'use client';

import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { Spinner } from '@gredice/ui/Spinner';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useEffect, useRef } from 'react';
import { FarmSignInShell } from '../../components/auth/FarmSignInShell';
import type { FarmOAuthProvider } from '../../lib/auth/safeFarmReturnPath';

export type OAuthCallbackErrorCode =
    | 'callback_error'
    | 'canceled'
    | 'exchange_error'
    | 'missing_token'
    | 'network_error'
    | 'provider_error'
    | 'state_invalid';

export type OAuthCallbackViewState =
    | { status: 'error'; code: OAuthCallbackErrorCode }
    | { status: 'processing' };

const ERROR_CONTENT: Record<
    OAuthCallbackErrorCode,
    { message: string; title: string }
> = {
    callback_error: {
        title: 'Prijava nije završena',
        message:
            'Prijavu trenutno nije moguće završiti. Pokušaj ponovno ili se vrati na prijavu.',
    },
    canceled: {
        title: 'Prijava je otkazana',
        message:
            'Nisi dovršio prijavu kod odabranog pružatelja. Tvoj račun nije promijenjen.',
    },
    exchange_error: {
        title: 'Prijava nije spremljena',
        message:
            'Podaci za prijavu nisu mogli biti sigurno spremljeni. Pokreni prijavu ponovno.',
    },
    missing_token: {
        title: 'Nedostaju podaci za prijavu',
        message:
            'Povratak s prijave nije sadržavao potrebne podatke. Pokreni prijavu ponovno.',
    },
    network_error: {
        title: 'Veza je prekinuta',
        message:
            'Provjeri internetsku vezu i pokreni prijavu ponovno. Podaci za prijavu nisu spremljeni.',
    },
    provider_error: {
        title: 'Pružatelj prijave nije dostupan',
        message:
            'Google ili Facebook nije uspio dovršiti prijavu. Pokušaj ponovno za nekoliko trenutaka.',
    },
    state_invalid: {
        title: 'Prijavu treba ponoviti',
        message:
            'Sigurnosna provjera prijave nije uspjela. Pokreni novu prijavu iz Gredice Farme.',
    },
};

function getProviderLabel(provider: FarmOAuthProvider) {
    return provider === 'google' ? 'Google' : 'Facebook';
}

interface OAuthCallbackPanelProps {
    onBack?: () => void;
    onRetry?: () => void;
    provider: FarmOAuthProvider;
    state: OAuthCallbackViewState;
}

export function OAuthCallbackPanel({
    onBack,
    onRetry,
    provider,
    state,
}: OAuthCallbackPanelProps) {
    const errorRef = useRef<HTMLDivElement>(null);
    const providerLabel = getProviderLabel(provider);

    useEffect(() => {
        if (state.status === 'error') {
            errorRef.current?.focus();
        }
    }, [state.status]);

    return (
        <FarmSignInShell>
            <Stack spacing={6}>
                <Stack spacing={2}>
                    <Typography className="text-xl" level="h2" semiBold>
                        {providerLabel} prijava
                    </Typography>
                    {state.status === 'processing' ? (
                        <Typography className="text-muted-foreground">
                            Sigurno završavamo tvoju prijavu.
                        </Typography>
                    ) : null}
                </Stack>

                {state.status === 'processing' ? (
                    <div
                        aria-live="polite"
                        className="flex min-h-11 items-center gap-3 rounded-lg border bg-muted/40 px-4 py-3"
                        role="status"
                    >
                        <Spinner
                            className="size-5 shrink-0"
                            loading
                            loadingLabel="Prijava u tijeku"
                        />
                        <Typography level="body2">Prijava u tijeku…</Typography>
                    </div>
                ) : (
                    <Stack spacing={4}>
                        <div ref={errorRef} tabIndex={-1}>
                            <Alert color="danger" role="alert">
                                <Stack spacing={1}>
                                    <Typography level="body2" semiBold>
                                        {ERROR_CONTENT[state.code].title}
                                    </Typography>
                                    <Typography level="body2">
                                        {ERROR_CONTENT[state.code].message}
                                    </Typography>
                                </Stack>
                            </Alert>
                        </div>
                        <Stack spacing={2}>
                            <Button
                                fullWidth
                                onClick={onRetry}
                                size="lg"
                                type="button"
                                variant="solid"
                            >
                                Pokušaj ponovno
                            </Button>
                            <Button
                                color="neutral"
                                fullWidth
                                onClick={onBack}
                                size="lg"
                                type="button"
                                variant="outlined"
                            >
                                Natrag na prijavu
                            </Button>
                        </Stack>
                    </Stack>
                )}
            </Stack>
        </FarmSignInShell>
    );
}
