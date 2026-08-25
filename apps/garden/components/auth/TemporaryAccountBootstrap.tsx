'use client';

import { temporaryAccountLoginOpenChangedEvent } from '@gredice/game';
import { Alert } from '@gredice/ui/Alert';
import { authCurrentUserQueryKeys } from '@gredice/ui/auth';
import { Button } from '@gredice/ui/Button';
import { Row } from '@gredice/ui/Row';
import { Spinner } from '@gredice/ui/Spinner';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
    type ReactNode,
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react';
import { hasReturningUserMarker } from '../../lib/auth/returningUser';
import LoginModal from './LoginModal';

let temporaryAccountBootstrapPromise: Promise<void> | null = null;

function bootstrapTemporaryAccount() {
    temporaryAccountBootstrapPromise ??= fetch(
        '/api/gredice/api/auth/temporary',
        {
            method: 'POST',
            credentials: 'include',
        },
    )
        .then((response) => {
            if (!response.ok) {
                throw new Error(
                    `Failed to create temporary account: ${response.status.toString()}`,
                );
            }
        })
        .finally(() => {
            temporaryAccountBootstrapPromise = null;
        });

    return temporaryAccountBootstrapPromise;
}

type BootstrapStatus =
    | 'checking'
    | 'awaiting-login'
    | 'creating'
    | 'failed'
    | 'ready';

export function TemporaryAccountBootstrap({
    children,
}: {
    children: ReactNode;
}) {
    const queryClient = useQueryClient();
    const router = useRouter();
    const [status, setStatus] = useState<BootstrapStatus>('checking');
    const [returningUser, setReturningUser] = useState(false);
    const [showLogin, setShowLogin] = useState(false);
    const [crossAppLoginOpen, setCrossAppLoginOpen] = useState(false);
    const mountedRef = useRef(false);

    const runBootstrap = useCallback(async () => {
        setStatus('creating');

        try {
            await bootstrapTemporaryAccount();
            if (!mountedRef.current) {
                return;
            }

            await queryClient.invalidateQueries({
                queryKey: authCurrentUserQueryKeys,
            });
            await queryClient.invalidateQueries();
            if (!mountedRef.current) {
                return;
            }

            setStatus('ready');
            router.refresh();
        } catch (error: unknown) {
            console.error('Temporary account bootstrap failed', { error });
            if (mountedRef.current) {
                setStatus('failed');
            }
        }
    }, [queryClient, router]);

    useEffect(() => {
        mountedRef.current = true;
        setReturningUser(hasReturningUserMarker());
        setCrossAppLoginOpen(
            new URL(window.location.href).searchParams.get('prijava') === '1',
        );
        setStatus('awaiting-login');

        return () => {
            mountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        function handleCrossAppLoginOpenChanged(event: Event) {
            if (!(event instanceof CustomEvent)) {
                return;
            }

            const detail: unknown = event.detail;
            if (
                typeof detail !== 'object' ||
                detail === null ||
                !('open' in detail) ||
                typeof detail.open !== 'boolean'
            ) {
                return;
            }

            const requestedByUrl =
                new URL(window.location.href).searchParams.get('prijava') ===
                '1';
            if (!detail.open && requestedByUrl) {
                return;
            }
            setCrossAppLoginOpen(detail.open);
        }

        window.addEventListener(
            temporaryAccountLoginOpenChangedEvent,
            handleCrossAppLoginOpenChanged,
        );
        return () =>
            window.removeEventListener(
                temporaryAccountLoginOpenChangedEvent,
                handleCrossAppLoginOpenChanged,
            );
    }, []);

    function handleRetry() {
        void runBootstrap();
    }

    function handleContinueWithoutLogin() {
        void runBootstrap();
    }

    const showStatus =
        status === 'checking' || status === 'creating' || status === 'failed';

    return (
        <>
            {children}
            {showStatus && (
                <div className="fixed inset-x-0 bottom-4 z-[55] flex justify-center px-4 pointer-events-none">
                    {status === 'checking' || status === 'creating' ? (
                        <Row
                            spacing={3}
                            className="pointer-events-auto rounded-full border bg-background/90 px-4 py-2 shadow-lg backdrop-blur"
                        >
                            <Spinner
                                loading
                                className="size-4"
                                loadingLabel="Pripremamo tvoj vrt..."
                            />
                            <Typography level="body2" semiBold>
                                Pripremamo tvoj vrt...
                            </Typography>
                        </Row>
                    ) : (
                        <Alert
                            color="warning"
                            className="pointer-events-auto max-w-md shadow-lg"
                        >
                            <Stack spacing={3}>
                                <Typography level="body2" semiBold>
                                    Nismo uspjeli pripremiti privremeni vrt.
                                </Typography>
                                <Row spacing={2} className="flex-wrap">
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="solid"
                                        onClick={handleRetry}
                                    >
                                        Pokušaj ponovno
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="plain"
                                        onClick={() => setShowLogin(true)}
                                    >
                                        Prijava
                                    </Button>
                                </Row>
                            </Stack>
                        </Alert>
                    )}
                </div>
            )}
            <LoginModal
                description={
                    status === 'awaiting-login'
                        ? returningUser
                            ? 'Prepoznali smo ovaj uređaj. Prijavi se kako bismo otvorili tvoj postojeći vrt.'
                            : 'Prijavi se kako bismo otvorili tvoj postojeći vrt ili nastavi bez prijave s privremenim vrtom.'
                        : undefined
                }
                dismissible={status !== 'awaiting-login'}
                onAuthenticated={() => setStatus('ready')}
                onContinueWithoutLogin={
                    status === 'awaiting-login'
                        ? handleContinueWithoutLogin
                        : undefined
                }
                onOpenChange={setShowLogin}
                open={
                    (status === 'awaiting-login' || showLogin) &&
                    !crossAppLoginOpen
                }
            />
        </>
    );
}
