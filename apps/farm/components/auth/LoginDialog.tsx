'use client';

import { getBrowserGrediceAppOrigin } from '@gredice/client';
import {
    authCurrentUserQueryKeys,
    FacebookLoginButton,
    GoogleLoginButton,
    useLastLoginProvider,
} from '@gredice/ui/auth';
import { Button } from '@gredice/ui/Button';
import { Mail } from '@gredice/ui/icons';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { usePostHog } from '@posthog/next';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getFarmLoginErrorCode } from '../../lib/auth/farmLoginContract';
import {
    type FarmOAuthProvider,
    getFarmOAuthStartUrl,
} from '../../lib/auth/safeFarmReturnPath';
import { queryClient } from '../providers/ClientAppProvider';
import { EmailLoginForm, type FarmLoginFailure } from './EmailLoginForm';
import { FarmSignInShell } from './FarmSignInShell';

export function LoginDialog() {
    const posthog = usePostHog();
    const router = useRouter();
    const [emailExpanded, setEmailExpanded] = useState(false);
    const [emailFailure, setEmailFailure] = useState<FarmLoginFailure | null>(
        null,
    );
    const [emailSubmitting, setEmailSubmitting] = useState(false);
    const emailAttemptRef = useRef(0);
    const restoreEmailTriggerFocusRef = useRef(false);
    const fetchLastLogin = useCallback(
        () => fetch('/api/gredice/api/auth/last-login'),
        [],
    );
    const lastLoginProvider = useLastLoginProvider(fetchLastLogin);
    useEffect(() => {
        if (!emailExpanded && restoreEmailTriggerFocusRef.current) {
            restoreEmailTriggerFocusRef.current = false;
            document.getElementById('farm-email-login-trigger')?.focus();
        }
    }, [emailExpanded]);

    const setBoundedEmailFailure = (
        code: ReturnType<typeof getFarmLoginErrorCode>,
        status?: number,
    ) => {
        emailAttemptRef.current += 1;
        setEmailFailure({ attempt: emailAttemptRef.current, code });
        posthog?.capture('user_login_failed', {
            provider: 'password',
            reason: code,
            status,
            surface: 'farm',
        });
    };

    const handleEmailLogin = async (email: string, password: string) => {
        setEmailSubmitting(true);
        setEmailFailure(null);
        try {
            posthog?.capture('user_login_started', {
                provider: 'password',
                surface: 'farm',
            });
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });
            const responseBody: unknown = await response
                .json()
                .catch(() => null);

            if (!response.ok) {
                const code = getFarmLoginErrorCode(responseBody);
                console.warn('Farm email login rejected', {
                    reason: code,
                    status: response.status,
                });
                setBoundedEmailFailure(code, response.status);
                return;
            }

            await queryClient.invalidateQueries({
                queryKey: authCurrentUserQueryKeys,
            });
            router.refresh();
        } catch {
            console.error('Farm email login request failed');
            setBoundedEmailFailure('service_unavailable');
        } finally {
            setEmailSubmitting(false);
        }
    };

    const handleEmailBack = () => {
        restoreEmailTriggerFocusRef.current = true;
        setEmailFailure(null);
        setEmailExpanded(false);
    };

    const handleOAuthLogin = (provider: FarmOAuthProvider) => {
        posthog?.capture('user_oauth_started', {
            provider,
            surface: 'farm',
        });
        window.location.href = getFarmOAuthStartUrl({
            apiOrigin: getBrowserGrediceAppOrigin('api'),
            farmOrigin: window.location.origin,
            provider,
            returnTo: `${window.location.pathname}${window.location.search}${window.location.hash}`,
        });
    };

    return (
        <FarmSignInShell>
            <Stack spacing={7}>
                <Stack spacing={2}>
                    <Typography level="h2" className="text-xl" semiBold>
                        Dobrodošli
                    </Typography>
                    <Typography className="text-muted-foreground">
                        Prijavi se s Gredice računom kako bi upravljao svojom
                        farmom.
                    </Typography>
                </Stack>
                {!emailExpanded ? (
                    <Stack spacing={2}>
                        <GoogleLoginButton
                            aria-describedby={
                                lastLoginProvider === 'google'
                                    ? 'farm-google-last-used'
                                    : undefined
                            }
                            lastUsed={lastLoginProvider === 'google'}
                            onClick={() => handleOAuthLogin('google')}
                            size="lg"
                        >
                            Google prijava
                        </GoogleLoginButton>
                        {lastLoginProvider === 'google' ? (
                            <Typography
                                className="text-center text-xs text-muted-foreground sm:sr-only"
                                id="farm-google-last-used"
                                level="body3"
                            >
                                Zadnje korišteno
                            </Typography>
                        ) : null}
                        <FacebookLoginButton
                            aria-describedby={
                                lastLoginProvider === 'facebook'
                                    ? 'farm-facebook-last-used'
                                    : undefined
                            }
                            lastUsed={lastLoginProvider === 'facebook'}
                            onClick={() => handleOAuthLogin('facebook')}
                            size="lg"
                        >
                            Facebook prijava
                        </FacebookLoginButton>
                        {lastLoginProvider === 'facebook' ? (
                            <Typography
                                className="text-center text-xs text-muted-foreground sm:sr-only"
                                id="farm-facebook-last-used"
                                level="body3"
                            >
                                Zadnje korišteno
                            </Typography>
                        ) : null}
                        <Button
                            color="neutral"
                            fullWidth
                            id="farm-email-login-trigger"
                            onClick={() => {
                                setEmailFailure(null);
                                setEmailExpanded(true);
                            }}
                            size="lg"
                            startDecorator={
                                <Mail
                                    aria-hidden="true"
                                    className="h-4 w-4 shrink-0"
                                />
                            }
                            type="button"
                            variant="outlined"
                        >
                            Email prijava
                        </Button>
                    </Stack>
                ) : (
                    <EmailLoginForm
                        failure={emailFailure}
                        loading={emailSubmitting}
                        onBack={handleEmailBack}
                        onSubmit={handleEmailLogin}
                    />
                )}
            </Stack>
        </FarmSignInShell>
    );
}

export default LoginDialog;
