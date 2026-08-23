'use client';

import { getBrowserGrediceAppOrigin } from '@gredice/client';
import { authCurrentUserQueryKeys } from '@gredice/ui/auth';
import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
    type FarmOAuthProvider,
    getFarmOAuthStartUrl,
    getSafeFarmReturnPath,
} from '../../lib/auth/safeFarmReturnPath';
import {
    type OAuthCallbackErrorCode,
    OAuthCallbackPanel,
    type OAuthCallbackViewState,
} from './OAuthCallbackPanel';

const OAUTH_CALLBACK_TIMEOUT_MS = 10_000;

function getServerCallbackErrorCode(
    value: string | null,
): OAuthCallbackErrorCode | null {
    switch (value) {
        case null:
            return null;
        case 'callback_error':
        case 'canceled':
        case 'provider_error':
        case 'state_invalid':
            return value;
        default:
            return 'callback_error';
    }
}

type OAuthCallbackForwarderProps = {
    provider: FarmOAuthProvider;
    returnTo: string;
    serverErrorCode: OAuthCallbackErrorCode | null;
};

type OAuthFragment = {
    refreshToken: string | null;
    token: string | null;
};

export function OAuthCallbackForwarder({
    provider,
    returnTo,
    serverErrorCode,
}: OAuthCallbackForwarderProps) {
    const queryClient = useQueryClient();
    const [viewState, setViewState] = useState<OAuthCallbackViewState>({
        status: 'processing',
    });
    const oauthFragmentRef = useRef<OAuthFragment | undefined>(undefined);

    useEffect(() => {
        const abortController = new AbortController();
        let active = true;
        let timeoutId: number | undefined;

        const forwardAuthSession = async () => {
            if (oauthFragmentRef.current === undefined) {
                const hash = window.location.hash.slice(1);
                const hashParams = new URLSearchParams(hash);
                oauthFragmentRef.current = {
                    refreshToken: hashParams.get('refreshToken'),
                    token: hashParams.get('token'),
                };

                if (hash) {
                    window.history.replaceState(
                        null,
                        '',
                        window.location.pathname + window.location.search,
                    );
                }
            }
            const { refreshToken, token } = oauthFragmentRef.current;

            if (serverErrorCode) {
                setViewState({ status: 'error', code: serverErrorCode });
                return;
            }

            if (!token) {
                setViewState({ status: 'error', code: 'missing_token' });
                return;
            }

            timeoutId = window.setTimeout(
                () => abortController.abort(),
                OAUTH_CALLBACK_TIMEOUT_MS,
            );

            try {
                const response = await fetch('/api/oauth-callback', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token, refreshToken }),
                    signal: abortController.signal,
                });

                if (!response.ok) {
                    console.error(
                        'OAuth callback cookie exchange failed',
                        response.status,
                    );
                    if (active) {
                        setViewState({
                            status: 'error',
                            code: 'exchange_error',
                        });
                    }
                    return;
                }
            } catch (cause) {
                console.error(
                    'OAuth callback request failed',
                    cause instanceof Error ? cause.name : 'unknown',
                );
                if (active) {
                    setViewState({ status: 'error', code: 'network_error' });
                }
                return;
            } finally {
                if (timeoutId !== undefined) {
                    window.clearTimeout(timeoutId);
                }
            }

            if (!active) {
                return;
            }
            await queryClient
                .invalidateQueries({ queryKey: authCurrentUserQueryKeys })
                .catch(() => undefined);
            window.location.replace(returnTo);
        };

        void forwardAuthSession();

        return () => {
            active = false;
            abortController.abort();
            if (timeoutId !== undefined) {
                window.clearTimeout(timeoutId);
            }
        };
    }, [queryClient, returnTo, serverErrorCode]);

    const handleRetry = () => {
        window.location.assign(
            getFarmOAuthStartUrl({
                apiOrigin: getBrowserGrediceAppOrigin('api'),
                farmOrigin: window.location.origin,
                provider,
                returnTo,
            }),
        );
    };

    return (
        <OAuthCallbackPanel
            onBack={() => window.location.replace(returnTo)}
            onRetry={handleRetry}
            provider={provider}
            state={viewState}
        />
    );
}

export function UrlAuthForward({ provider }: { provider: FarmOAuthProvider }) {
    const searchParams = useSearchParams();
    const returnTo = getSafeFarmReturnPath(searchParams.get('returnTo'));
    const serverErrorCode = getServerCallbackErrorCode(
        searchParams.get('error'),
    );

    return (
        <OAuthCallbackForwarder
            provider={provider}
            returnTo={returnTo}
            serverErrorCode={serverErrorCode}
        />
    );
}
