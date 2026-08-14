'use client';

import { Button } from '@gredice/ui/Button';
import { LayoutGrid, Sprout } from '@gredice/ui/icons';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { parseAsInteger, useQueryState } from 'nuqs';
import { useCallback, useEffect, useRef } from 'react';
import { useGameAnalytics } from '../analytics/GameAnalyticsContext';
import { useOutletOffers } from '../hooks/useOutletOffers';
import type { OutletGardenCommerceController } from './OutletGardenCommerce';
import { OutletGardenOfferBrowser } from './OutletGardenOfferBrowser';
import type { OutletGardenFallbackReason } from './outletGardenRenderer';

function fallbackMessage(reason: OutletGardenFallbackReason) {
    switch (reason) {
        case 'unsupported_webgl':
            return 'Ovaj uređaj ne može prikazati vrt. Sve dostupne sadnice možeš pregledati i odabrati u popisu.';
        case 'constrained_device':
            return 'Za ugodniji rad prikazujemo laganiji popis sa svim aktualnim ponudama.';
        case 'context_lost':
        case 'scene_load_error':
        case 'scene_ready_timeout':
            return 'Prikaz vrta je prekinut. Odabrana sadnica i sve aktualne ponude ostale su dostupne u popisu.';
        case 'user':
            return 'Pregledavaš sve aktualne ponude u preglednom popisu.';
    }
}

export type OutletGardenBrowserViewerProps = {
    commerce?: OutletGardenCommerceController;
    fallbackReason?: OutletGardenFallbackReason;
    onAuthenticationRequired?: () => void;
    onUse3D?: () => void;
};

export function OutletGardenBrowserViewer({
    commerce,
    fallbackReason = 'user',
    onAuthenticationRequired,
    onUse3D,
}: OutletGardenBrowserViewerProps = {}) {
    const router = useRouter();
    const {
        data: offers = [],
        isError,
        isLoading,
        refetch,
    } = useOutletOffers();
    const [selectedOfferId, setSelectedOfferId] = useQueryState(
        'ponuda',
        parseAsInteger,
    );
    const { track } = useGameAnalytics();
    const fallbackStatusRef = useRef<HTMLParagraphElement>(null);

    useEffect(() => {
        fallbackStatusRef.current?.focus({ preventScroll: true });
    }, []);

    const selectOffer = useCallback(
        (offerId: number | null) => {
            void setSelectedOfferId(offerId);
            if (offerId === null) {
                return;
            }

            const offer = offers.find((candidate) => candidate.id === offerId);
            track('game_outlet_garden_offer_viewed', {
                outlet_offer_id: offerId,
                plant_sort_id: offer?.plantSort.id,
                renderer: 'list',
            });
        },
        [offers, setSelectedOfferId, track],
    );

    const requestExit = useCallback(
        (destination: 'existing_outlet' | 'garden', href: Route) => {
            track('game_outlet_garden_exited', {
                destination,
                renderer: 'list',
            });
            router.push(href);
        },
        [router, track],
    );

    const request3D = useCallback(() => {
        track('game_outlet_garden_3d_retry_requested', {
            fallback_reason: fallbackReason,
            renderer: 'list',
        });
        onUse3D?.();
    }, [fallbackReason, onUse3D, track]);

    const retryOffers = useCallback(() => {
        track('game_outlet_garden_offers_retry_requested', {
            renderer: 'list',
        });
        void refetch();
    }, [refetch, track]);

    return (
        <div
            className="grid h-[100dvh] min-h-0 overflow-hidden bg-[#cfeaca] lg:grid-cols-[minmax(0,1fr)_24rem]"
            data-outlet-garden
            data-outlet-garden-renderer="list"
        >
            <div
                aria-hidden="true"
                className="relative hidden place-items-center overflow-hidden bg-[radial-gradient(circle_at_50%_35%,#effbe9_0%,#cfeaca_45%,#9fc99e_100%)] lg:grid"
            >
                <div className="grid max-w-sm place-items-center px-8 text-center text-green-950">
                    <span className="grid size-20 place-items-center rounded-full bg-white/65 shadow-lg backdrop-blur-sm">
                        <Sprout className="size-11" />
                    </span>
                    <p className="mt-4 text-base font-semibold">
                        Ponude su dostupne u preglednom popisu
                    </p>
                </div>
            </div>

            <OutletGardenOfferBrowser
                className="border-t-0 lg:border-l"
                commerce={commerce}
                headerAction={
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-lime-300 bg-lime-50 p-3 text-sm text-lime-950 dark:border-lime-900 dark:bg-lime-950/40 dark:text-lime-50">
                        <p
                            className="min-w-48 flex-1"
                            ref={fallbackStatusRef}
                            role="status"
                            tabIndex={-1}
                        >
                            {fallbackMessage(fallbackReason)}
                        </p>
                        {onUse3D ? (
                            <Button
                                aria-label="Pokušaj ponovno otvoriti prikaz vrta"
                                onClick={request3D}
                                size="lg"
                                startDecorator={
                                    <LayoutGrid className="size-4" />
                                }
                                variant="outlined"
                            >
                                Vrati prikaz vrta
                            </Button>
                        ) : null}
                    </div>
                }
                isError={isError}
                isLoading={isLoading}
                offers={offers}
                onExit={requestExit}
                onAuthenticationRequired={onAuthenticationRequired}
                onRetry={retryOffers}
                onSelectOffer={selectOffer}
                selectedOfferId={selectedOfferId}
            />
        </div>
    );
}

export type {
    OutletGardenFallbackReason,
    OutletGardenRenderer,
    OutletGardenSceneFailureReason,
} from './outletGardenRenderer';
