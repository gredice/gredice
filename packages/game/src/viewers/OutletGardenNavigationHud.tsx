'use client';

import { Button } from '@gredice/ui/Button';
import { ArrowLeft, LayoutList } from '@gredice/ui/icons';
import type { Route } from 'next';
import { HudCard } from '../hud/components/HudCard';

export function OutletGardenNavigationHud({
    offerListOpen,
    onOpenOfferList,
    onRequestExit,
}: {
    offerListOpen: boolean;
    onOpenOfferList: () => void;
    onRequestExit: (
        destination: 'existing_outlet' | 'garden',
        href: Route,
    ) => void;
}) {
    return (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 bg-linear-to-b from-black/25 to-transparent p-3 pb-10 sm:p-4">
            <HudCard
                className="static p-0.5"
                data-outlet-garden-hud-card="garden-link"
                open
                position="floating"
            >
                <Button
                    className="pointer-events-auto rounded-full"
                    href="/"
                    onClick={(event) => {
                        event.preventDefault();
                        onRequestExit('garden', '/');
                    }}
                    size="lg"
                    startDecorator={<ArrowLeft className="size-4" />}
                    variant="plain"
                >
                    Moj vrt
                </Button>
            </HudCard>
            <HudCard
                className="static p-0.5"
                data-outlet-garden-hud-card="offer-list"
                open
                position="floating"
            >
                <Button
                    aria-controls="outlet-garden-browser"
                    aria-expanded={offerListOpen}
                    aria-label="Prikaži popis dostupnih sadnica"
                    className="pointer-events-auto rounded-full"
                    data-outlet-garden-list-trigger
                    onClick={onOpenOfferList}
                    size="lg"
                    startDecorator={<LayoutList className="size-4" />}
                    variant="plain"
                >
                    Popis ponuda
                </Button>
            </HudCard>
        </div>
    );
}
