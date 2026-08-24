'use client';

import { Button } from '@gredice/ui/Button';
import { SquareArrowRightEnter } from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { Typography } from '@gredice/ui/Typography';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useGameAnalytics } from '../analytics/GameAnalyticsContext';
import {
    isTemporaryAccountLoginOpen,
    requestTemporaryAccountLogin,
    type TemporaryAccountLoginOpenChangedDetail,
    temporaryAccountLoginOpenChangedEvent,
} from '../temporaryAccountAuth';
import { HudCard } from './components/HudCard';

function isLoginOpenChangedDetail(
    value: unknown,
): value is TemporaryAccountLoginOpenChangedDetail {
    return (
        typeof value === 'object' &&
        value !== null &&
        'open' in value &&
        typeof value.open === 'boolean'
    );
}

export function TemporaryAccountAuthHud() {
    const { track } = useGameAnalytics();
    const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(
        null,
    );
    const [loginRequested, setLoginRequested] = useState(
        isTemporaryAccountLoginOpen,
    );

    useEffect(() => {
        setPortalContainer(document.body);

        function handleLoginOpenChanged(event: Event) {
            if (!(event instanceof CustomEvent)) {
                return;
            }

            const detail: unknown = event.detail;
            if (!isLoginOpenChangedDetail(detail)) {
                return;
            }

            setLoginRequested(detail.open);
        }

        window.addEventListener(
            temporaryAccountLoginOpenChangedEvent,
            handleLoginOpenChanged,
        );
        return () =>
            window.removeEventListener(
                temporaryAccountLoginOpenChangedEvent,
                handleLoginOpenChanged,
            );
    }, []);

    if (loginRequested) {
        return null;
    }

    function handleLoginRequest() {
        track('game_temporary_account_login_opened', {
            source: 'temporary_account_hud',
        });
        setLoginRequested(true);
        requestTemporaryAccountLogin();
    }

    if (!portalContainer) {
        return null;
    }

    return createPortal(
        <div
            className="pointer-events-none fixed top-[calc(var(--game-safe-area-top,0px)+0.5rem)] right-[var(--game-safe-area-right,0px)] left-[var(--game-safe-area-left,0px)] z-[55] flex justify-center px-14 sm:px-4"
            data-game-hud-temporary-auth="true"
        >
            <HudCard
                className="pointer-events-auto static max-w-full border-primary/30 bg-background/95 p-1.5 shadow-xl backdrop-blur-md sm:py-2 sm:pl-4"
                open
                position="floating"
            >
                <Row spacing={3} className="min-w-0">
                    <Typography
                        className="hidden min-w-0 sm:block"
                        level="body2"
                        semiBold
                    >
                        Već imaš Gredice račun?
                    </Typography>
                    <Button
                        className="whitespace-nowrap shadow-sm"
                        color="success"
                        onClick={handleLoginRequest}
                        size="sm"
                        startDecorator={
                            <SquareArrowRightEnter className="size-4" />
                        }
                        type="button"
                    >
                        Prijava ili registracija
                    </Button>
                </Row>
            </HudCard>
        </div>,
        portalContainer,
    );
}
