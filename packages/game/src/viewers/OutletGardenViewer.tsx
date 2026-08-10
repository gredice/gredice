'use client';

import { Button } from '@gredice/ui/Button';
import { ArrowLeft, Sprout } from '@gredice/ui/icons';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { parseAsInteger, useQueryState } from 'nuqs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGameAnalytics } from '../analytics/GameAnalyticsContext';
import { useOutletOffers } from '../hooks/useOutletOffers';
import { OutletGardenOfferBrowser } from './OutletGardenOfferBrowser';
import { OutletGardenSeedlingMarkers } from './OutletGardenSeedlingMarkers';
import {
    buildOutletGardenDetail,
    type OutletGardenLayoutOffer,
    type OutletGardenSlotAssignments,
    outletOfferBlockId,
    outletOfferIdFromBlockId,
    reconcileOutletGardenSlots,
} from './outletGardenLayout';
import {
    getPublicGardenCaptureInitialView,
    normalizePublicGardenStacks,
    type PublicGardenInitialView,
    PublicGardenViewer,
    publicGardenStacksFromResponse,
} from './PublicGardenViewer';

const outletGardenPreviewTime = new Date('2026-06-21T10:00:00.000Z');

function OutletGardenScenePlaceholder({ label }: { label: string }) {
    return (
        <div className="relative grid size-full place-items-center overflow-hidden bg-[radial-gradient(circle_at_50%_35%,#effbe9_0%,#cfeaca_45%,#9fc99e_100%)]">
            <div
                aria-hidden="true"
                className="absolute inset-x-[8%] bottom-[-25%] h-[60%] rotate-[-4deg] rounded-[50%] bg-[#6f9e65]/35 blur-2xl"
            />
            <div className="relative grid place-items-center text-center text-green-950">
                <span className="grid size-16 place-items-center rounded-full bg-white/65 shadow-lg backdrop-blur-sm">
                    <Sprout className="size-9" />
                </span>
                <p className="mt-3 max-w-56 text-sm font-semibold">{label}</p>
            </div>
        </div>
    );
}

export function OutletGardenViewer() {
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
    const openedTrackedRef = useRef(false);
    const sceneReadyTrackedRef = useRef(false);
    const sceneContainerRef = useRef<HTMLElement>(null);
    const [initialSceneViewport, setInitialSceneViewport] = useState<{
        height: number;
        width: number;
    } | null>(null);
    const [sceneInitialView, setSceneInitialView] =
        useState<PublicGardenInitialView | null>(null);
    const [exitTarget, setExitTarget] = useState<{
        destination: 'existing_outlet' | 'garden';
        href: Route;
    } | null>(null);
    const layoutOffersKey = useMemo(
        () =>
            Array.from(
                new Map(
                    offers.map((offer) => [
                        offer.id,
                        {
                            id: offer.id,
                            plantId: offer.plantSort.plant?.id ?? null,
                            plantSortId: offer.plantSort.id,
                        },
                    ]),
                ).values(),
            )
                .sort((left, right) => left.id - right.id)
                .map((offer) =>
                    [offer.id, offer.plantId ?? 0, offer.plantSortId].join(':'),
                )
                .join(','),
        [offers],
    );
    const layoutOffers = useMemo(() => {
        if (layoutOffersKey.length === 0) {
            return [];
        }

        return layoutOffersKey.split(',').flatMap((encodedOffer) => {
            const [offerIdValue, plantIdValue, plantSortIdValue] = encodedOffer
                .split(':')
                .map(Number);
            if (
                !Number.isSafeInteger(offerIdValue) ||
                !Number.isSafeInteger(plantIdValue) ||
                !Number.isSafeInteger(plantSortIdValue) ||
                offerIdValue <= 0 ||
                plantIdValue < 0 ||
                plantSortIdValue <= 0
            ) {
                return [];
            }

            return [
                {
                    id: offerIdValue,
                    plantId: plantIdValue === 0 ? null : plantIdValue,
                    plantSortId: plantSortIdValue,
                } satisfies OutletGardenLayoutOffer,
            ];
        });
    }, [layoutOffersKey]);
    const [slotAssignments, setSlotAssignments] =
        useState<OutletGardenSlotAssignments>(() => new Map());
    const reconciledSlotAssignments = useMemo(
        () => reconcileOutletGardenSlots(slotAssignments, layoutOffers),
        [layoutOffers, slotAssignments],
    );

    useEffect(() => {
        if (reconciledSlotAssignments !== slotAssignments) {
            setSlotAssignments(reconciledSlotAssignments);
        }
    }, [reconciledSlotAssignments, slotAssignments]);

    const layoutReady = layoutOffers.every((offer) =>
        reconciledSlotAssignments.has(offer.id),
    );
    const outletGarden = useMemo(
        () => buildOutletGardenDetail(layoutOffers, reconciledSlotAssignments),
        [layoutOffers, reconciledSlotAssignments],
    );
    const interactiveBlockIds = useMemo(
        () =>
            new Set(layoutOffers.map((offer) => outletOfferBlockId(offer.id))),
        [layoutOffers],
    );
    const selectedOffer =
        offers.find((offer) => offer.id === selectedOfferId) ?? null;
    const selectedBlockId = selectedOffer
        ? outletOfferBlockId(selectedOffer.id)
        : null;

    useEffect(() => {
        const element = sceneContainerRef.current;
        if (!element || initialSceneViewport) {
            return;
        }

        const measure = () => {
            const bounds = element.getBoundingClientRect();
            if (bounds.width < 1 || bounds.height < 1) {
                return;
            }

            setInitialSceneViewport(
                (current) =>
                    current ?? { height: bounds.height, width: bounds.width },
            );
        };

        measure();
        if (typeof ResizeObserver === 'undefined') {
            return;
        }

        const observer = new ResizeObserver(measure);
        observer.observe(element);
        return () => observer.disconnect();
    }, [initialSceneViewport]);

    useEffect(() => {
        if (
            sceneInitialView ||
            !initialSceneViewport ||
            !layoutReady ||
            offers.length === 0
        ) {
            return;
        }

        setSceneInitialView(
            getPublicGardenCaptureInitialView({
                minimumZoom: 18,
                stacks: normalizePublicGardenStacks(
                    publicGardenStacksFromResponse(outletGarden.stacks),
                ),
                viewport: initialSceneViewport,
            }),
        );
    }, [
        initialSceneViewport,
        layoutReady,
        offers.length,
        outletGarden.stacks,
        sceneInitialView,
    ]);

    useEffect(() => {
        if (openedTrackedRef.current || isLoading) {
            return;
        }

        openedTrackedRef.current = true;
        track('game_outlet_garden_opened', {
            outlet_offer_count: offers.length,
            selected_offer_id: selectedOfferId,
        });
    }, [isLoading, offers.length, selectedOfferId, track]);

    const trackSceneReady = useCallback(() => {
        if (sceneReadyTrackedRef.current) {
            return;
        }

        sceneReadyTrackedRef.current = true;
        track('game_outlet_garden_scene_ready', {
            outlet_offer_count: offers.length,
        });
    }, [offers.length, track]);

    const requestExit = useCallback(
        (destination: 'existing_outlet' | 'garden', href: Route) => {
            if (exitTarget) {
                return;
            }

            track('game_outlet_garden_exited', { destination });
            setExitTarget({ destination, href });
        },
        [exitTarget, track],
    );

    useEffect(() => {
        if (!exitTarget) {
            return;
        }

        const reducedMotion = window.matchMedia(
            '(prefers-reduced-motion: reduce)',
        ).matches;
        if (reducedMotion) {
            router.push(exitTarget.href);
            return;
        }

        const timeout = window.setTimeout(() => {
            router.push(exitTarget.href);
        }, 220);
        return () => window.clearTimeout(timeout);
    }, [exitTarget, router]);

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
            });
        },
        [offers, setSelectedOfferId, track],
    );

    const selectBlock = useCallback(
        (blockId: string) => {
            const offerId = outletOfferIdFromBlockId(blockId);
            if (offerId !== null) {
                selectOffer(offerId);
            }
        },
        [selectOffer],
    );

    return (
        <div
            className={`relative grid h-[100dvh] grid-rows-[minmax(0,1fr)_minmax(18rem,46dvh)] overflow-hidden bg-[#cfeaca] lg:grid-cols-[minmax(0,1fr)_24rem] lg:grid-rows-1 ${exitTarget ? 'motion-safe:animate-out motion-safe:fade-out-0 motion-safe:zoom-out-95 motion-safe:duration-200' : 'motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:duration-500'}`}
            data-outlet-garden
            data-outlet-garden-exiting={exitTarget ? true : undefined}
        >
            <main
                className="relative min-h-0 overflow-hidden"
                ref={sceneContainerRef}
            >
                {layoutReady && offers.length > 0 && sceneInitialView ? (
                    <PublicGardenViewer
                        appBaseUrl=""
                        cameraMinZoom={18}
                        className="size-full"
                        fixedTime={outletGardenPreviewTime}
                        garden={outletGarden}
                        initialView={sceneInitialView}
                        interactiveBlockIds={interactiveBlockIds}
                        noWeather
                        onSelectBlock={selectBlock}
                        onSceneReady={trackSceneReady}
                        renderDetails={false}
                        sceneChildren={
                            <OutletGardenSeedlingMarkers
                                offers={layoutOffers}
                                stacks={outletGarden.stacks}
                            />
                        }
                        selectedBlockId={selectedBlockId}
                        spriteBaseUrl=""
                    />
                ) : (
                    <OutletGardenScenePlaceholder
                        label={
                            isError
                                ? 'Outlet vrt čeka ponovni pokušaj učitavanja.'
                                : offers.length === 0 && !isLoading
                                  ? 'Nove sadnice uskoro stižu u Outlet vrt.'
                                  : 'Teleportiramo te u Outlet vrt...'
                        }
                    />
                )}

                <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 bg-linear-to-b from-black/25 to-transparent p-3 pb-10 sm:p-4">
                    <Button
                        className="pointer-events-auto border-white/60 bg-white/85 shadow-lg backdrop-blur"
                        href="/"
                        onClick={(event) => {
                            event.preventDefault();
                            requestExit('garden', '/');
                        }}
                        size="sm"
                        startDecorator={<ArrowLeft className="size-4" />}
                        variant="outlined"
                    >
                        Moj vrt
                    </Button>
                    <div className="hidden max-w-xs rounded-xl bg-black/55 px-3 py-2 text-right text-xs text-white shadow-lg backdrop-blur sm:block">
                        <p className="font-semibold">Razgledaj Outlet vrt</p>
                        <p className="mt-0.5 text-white/80">
                            Povuci za zakretanje · kotačić ili dva prsta za
                            približavanje
                        </p>
                    </div>
                </div>

                {selectedOffer ? (
                    <div className="pointer-events-none absolute bottom-3 left-3 z-10 hidden sm:block">
                        <div className="flex items-center gap-2 rounded-full bg-white/85 px-3 py-2 text-xs font-medium shadow-lg backdrop-blur">
                            <Sprout className="size-4 text-lime-800" />
                            Odabrano: {selectedOffer.plantSort.name}
                        </div>
                    </div>
                ) : null}
            </main>

            <OutletGardenOfferBrowser
                isError={isError}
                isLoading={isLoading}
                offers={offers}
                onExit={requestExit}
                onRetry={() => {
                    void refetch();
                }}
                onSelectOffer={selectOffer}
                selectedOfferId={selectedOfferId}
            />
        </div>
    );
}
