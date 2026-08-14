'use client';

import { Button } from '@gredice/ui/Button';
import { ArrowLeft, Footprints, LayoutList, Sprout } from '@gredice/ui/icons';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { parseAsInteger, useQueryState } from 'nuqs';
import {
    Suspense,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { useGameAnalytics } from '../analytics/GameAnalyticsContext';
import type { GardenVisitorPresenceController } from '../entities/avatar/gardenVisitorPresence';
import { useOutletOffers } from '../hooks/useOutletOffers';
import { ControlsTooltipHud } from '../hud/ControlsTooltipHud';
import { ButtonGreen } from '../shared-ui/ButtonGreen';
import { GameModal } from '../shared-ui/game-modal';
import type { GardenAvatarView } from '../useGameState';
import type { OutletGardenCommerceController } from './OutletGardenCommerce';
import { OutletGardenOfferBrowser } from './OutletGardenOfferBrowser';
import { OutletGardenProductSigns } from './OutletGardenProductSigns';
import { OutletGardenSeedlingMarkers } from './OutletGardenSeedlingMarkers';
import {
    buildOutletGardenDetail,
    getOutletGardenDisplayUnits,
    getOutletGardenOfferPlacement,
    getOutletGardenProductSignPlacements,
    isOutletGardenDisplayLimited,
    type OutletGardenLayoutOffer,
    type OutletGardenSlotAssignments,
    outletGardenVisitorSpawnPoint,
    outletOfferBlockId,
    outletOfferDisplayFromBlockId,
    outletOfferIdFromBlockId,
    reconcileOutletGardenSlots,
} from './outletGardenLayout';
import type { OutletGardenSceneFailureReason } from './outletGardenRenderer';
import {
    getPublicGardenCaptureInitialView,
    normalizePublicGardenStacks,
    type PublicGardenInitialView,
    type PublicGardenSelectedBlockFocus,
    PublicGardenViewer,
    publicGardenStacksFromResponse,
} from './PublicGardenViewer';

const outletGardenCameraMinZoom = 10;
const outletGardenCloseupZoom = 210;
const outletLocalVisitorPresence = {
    localVisitorId: 'outlet-local-visitor',
    onLocalPresenceChange: () => {},
    visitors: [],
} satisfies GardenVisitorPresenceController;

export type OutletGardenViewerProps = {
    commerce?: OutletGardenCommerceController;
    focusOnMount?: boolean;
    onAuthenticationRequired?: () => void;
    onSceneFailure?: (reason: OutletGardenSceneFailureReason) => void;
    onSceneReady?: () => void;
    onUseListFallback?: () => void;
    sceneStartedAt?: number;
};

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

export function OutletGardenViewer({
    commerce,
    focusOnMount = false,
    onAuthenticationRequired,
    onSceneFailure,
    onSceneReady,
    onUseListFallback,
    sceneStartedAt,
}: OutletGardenViewerProps = {}) {
    const router = useRouter();
    const {
        data: sceneOffers = [],
        isError,
        isLoading,
        refetch,
    } = useOutletOffers({ includeSoldOut: true });
    const offers = useMemo(
        () => sceneOffers.filter((offer) => offer.remainingQuantity > 0),
        [sceneOffers],
    );
    const [selectedOfferId, setSelectedOfferId] = useQueryState(
        'ponuda',
        parseAsInteger,
    );
    const [hoveredOfferId, setHoveredOfferId] = useState<number | null>(null);
    const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);
    const [offerListOpen, setOfferListOpen] = useState(false);
    const [avatarView, setAvatarView] = useState<GardenAvatarView>('overview');
    const avatarViewRef = useRef<GardenAvatarView>('overview');
    const [avatarActivationRequest, setAvatarActivationRequest] = useState(0);
    const { track } = useGameAnalytics();
    const openedTrackedRef = useRef(false);
    const sceneFailureTrackedRef = useRef(false);
    const sceneReadyTrackedRef = useRef(false);
    const sceneStartedAtRef = useRef(sceneStartedAt ?? Date.now());
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
    const sceneElapsedMs = useCallback(
        () => Math.max(0, Date.now() - sceneStartedAtRef.current),
        [],
    );
    const handleLocalVisitorViewChange = useCallback(
        (nextView: GardenAvatarView) => {
            if (avatarViewRef.current === nextView) {
                return;
            }

            avatarViewRef.current = nextView;
            if (nextView !== 'overview') {
                setHoveredOfferId(null);
            }
            setAvatarView(nextView);
        },
        [],
    );
    useEffect(() => {
        if (focusOnMount) {
            sceneContainerRef.current?.focus({ preventScroll: true });
        }
    }, [focusOnMount]);
    const layoutOffersKey = useMemo(
        () =>
            Array.from(
                new Map(
                    sceneOffers.map((offer) => [
                        offer.id,
                        {
                            id: offer.id,
                            plantId: offer.plantSort.plant?.id ?? null,
                            plantSortId: offer.plantSort.id,
                            remainingQuantity: Math.max(
                                0,
                                Math.trunc(offer.remainingQuantity),
                            ),
                        },
                    ]),
                ).values(),
            )
                .sort((left, right) => left.id - right.id)
                .map((offer) =>
                    [
                        offer.id,
                        offer.plantId ?? 0,
                        offer.plantSortId,
                        offer.remainingQuantity,
                    ].join(':'),
                )
                .join(','),
        [sceneOffers],
    );
    const layoutOffers = useMemo(() => {
        if (layoutOffersKey.length === 0) {
            return [];
        }

        return layoutOffersKey.split(',').flatMap((encodedOffer) => {
            const [
                offerIdValue,
                plantIdValue,
                plantSortIdValue,
                remainingQuantityValue,
            ] = encodedOffer.split(':').map(Number);
            if (
                !Number.isSafeInteger(offerIdValue) ||
                !Number.isSafeInteger(plantIdValue) ||
                !Number.isSafeInteger(plantSortIdValue) ||
                !Number.isSafeInteger(remainingQuantityValue) ||
                offerIdValue <= 0 ||
                plantIdValue < 0 ||
                plantSortIdValue <= 0 ||
                remainingQuantityValue < 0
            ) {
                return [];
            }

            return [
                {
                    id: offerIdValue,
                    plantId: plantIdValue === 0 ? null : plantIdValue,
                    plantSortId: plantSortIdValue,
                    remainingQuantity: remainingQuantityValue,
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

    const displayUnits = useMemo(
        () => getOutletGardenDisplayUnits(layoutOffers),
        [layoutOffers],
    );
    const displayLimited = useMemo(
        () => isOutletGardenDisplayLimited(layoutOffers),
        [layoutOffers],
    );
    const layoutReady = displayUnits.every((display) =>
        reconciledSlotAssignments.has(display.blockId),
    );
    const sceneAvailable =
        layoutReady && sceneOffers.length > 0 && sceneInitialView !== null;
    const visibleAvatarView = sceneAvailable ? avatarView : 'overview';
    const avatarWalking = visibleAvatarView !== 'overview';

    useEffect(() => {
        if (sceneAvailable || avatarView === 'overview') {
            return;
        }

        avatarViewRef.current = 'overview';
        setAvatarView('overview');
    }, [avatarView, sceneAvailable]);

    const outletGarden = useMemo(
        () => buildOutletGardenDetail(layoutOffers, reconciledSlotAssignments),
        [layoutOffers, reconciledSlotAssignments],
    );
    const productSignPlacements = useMemo(
        () =>
            getOutletGardenProductSignPlacements(
                layoutOffers,
                reconciledSlotAssignments,
            ),
        [layoutOffers, reconciledSlotAssignments],
    );
    const interactiveBlockIds = useMemo(
        () => new Set(displayUnits.map((display) => display.blockId)),
        [displayUnits],
    );
    const selectedOffer =
        offers.find((offer) => offer.id === selectedOfferId) ?? null;
    const focusedDisplay = focusedBlockId
        ? outletOfferDisplayFromBlockId(focusedBlockId)
        : null;
    const selectedBlockId = selectedOffer
        ? focusedDisplay?.offerId === selectedOffer.id &&
          interactiveBlockIds.has(focusedBlockId ?? '')
            ? focusedBlockId
            : outletOfferBlockId(selectedOffer.id)
        : null;
    const selectedBlockFocus = useMemo<
        PublicGardenSelectedBlockFocus | undefined
    >(() => {
        if (!selectedBlockId) {
            return undefined;
        }

        const assignment = reconciledSlotAssignments.get(selectedBlockId);
        if (!assignment) {
            return undefined;
        }

        const placement = getOutletGardenOfferPlacement(assignment.slotIndex);
        return {
            mode: 'preserve-angle',
            target: {
                x: placement.x,
                y: placement.surface === 'table' ? 1.5 : 0.9,
                z: placement.y,
            },
            zoom: outletGardenCloseupZoom,
        };
    }, [reconciledSlotAssignments, selectedBlockId]);

    useEffect(() => {
        if (
            hoveredOfferId !== null &&
            !offers.some((offer) => offer.id === hoveredOfferId)
        ) {
            setHoveredOfferId(null);
        }
    }, [hoveredOfferId, offers]);

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
            sceneOffers.length === 0
        ) {
            return;
        }

        setSceneInitialView(
            getPublicGardenCaptureInitialView({
                minimumZoom: outletGardenCameraMinZoom,
                stacks: normalizePublicGardenStacks(
                    publicGardenStacksFromResponse(outletGarden.stacks),
                ),
                viewport: initialSceneViewport,
            }),
        );
    }, [
        initialSceneViewport,
        layoutReady,
        sceneOffers.length,
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
            renderer: 'webgl',
            selected_offer_id: selectedOfferId,
        });
    }, [isLoading, offers.length, selectedOfferId, track]);

    const trackSceneReady = useCallback(() => {
        if (sceneReadyTrackedRef.current) {
            return;
        }

        sceneReadyTrackedRef.current = true;
        track('game_outlet_garden_scene_ready', {
            device_class: window.innerWidth < 768 ? 'mobile' : 'desktop',
            input_mode: navigator.maxTouchPoints > 0 ? 'touch' : 'pointer',
            outlet_offer_count: offers.length,
            renderer: 'webgl',
            scene_ready_duration_ms: sceneElapsedMs(),
        });
        onSceneReady?.();
    }, [offers.length, onSceneReady, sceneElapsedMs, track]);

    const reportSceneFailure = useCallback(
        (reason: OutletGardenSceneFailureReason) => {
            if (sceneFailureTrackedRef.current) {
                return;
            }

            sceneFailureTrackedRef.current = true;
            onSceneFailure?.(reason);
        },
        [onSceneFailure],
    );

    const reportSceneContextLost = useCallback(() => {
        reportSceneFailure('context_lost');
    }, [reportSceneFailure]);

    const requestExit = useCallback(
        (destination: 'existing_outlet' | 'garden', href: Route) => {
            if (exitTarget) {
                return;
            }

            track('game_outlet_garden_exited', {
                destination,
                renderer: 'webgl',
                scene_ready: sceneReadyTrackedRef.current,
            });
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
        const navigate = () => {
            if (exitTarget.destination === 'garden') {
                // React Three Fiber tears down a WebGL root asynchronously.
                // Start the user garden in a fresh document so its renderer
                // cannot overlap that delayed Outlet renderer cleanup.
                window.location.assign(exitTarget.href);
            } else {
                router.push(exitTarget.href);
            }
        };
        const handlePageShow = (event: PageTransitionEvent) => {
            if (event.persisted) {
                setExitTarget(null);
            }
        };
        window.addEventListener('pageshow', handlePageShow);

        if (reducedMotion) {
            navigate();
            return () => window.removeEventListener('pageshow', handlePageShow);
        }

        const timeout = window.setTimeout(navigate, 220);
        return () => {
            window.clearTimeout(timeout);
            window.removeEventListener('pageshow', handlePageShow);
        };
    }, [exitTarget, router]);

    const selectOffer = useCallback(
        (offerId: number | null, blockId?: string) => {
            void setSelectedOfferId(offerId);
            setOfferListOpen(false);
            setHoveredOfferId(null);
            if (offerId === null) {
                setFocusedBlockId(null);
                return;
            }

            setFocusedBlockId(blockId ?? outletOfferBlockId(offerId));
            const offer = offers.find((candidate) => candidate.id === offerId);
            track('game_outlet_garden_offer_viewed', {
                outlet_offer_id: offerId,
                plant_sort_id: offer?.plantSort.id,
                renderer: 'webgl',
            });
        },
        [offers, setSelectedOfferId, track],
    );

    const openOfferList = useCallback(() => {
        setFocusedBlockId(null);
        setHoveredOfferId(null);
        setOfferListOpen(true);
        track('game_outlet_garden_offer_list_opened', {
            outlet_offer_count: offers.length,
            renderer: 'webgl',
        });
    }, [offers.length, track]);

    const requestListFallback = useCallback(() => {
        track('game_outlet_garden_fallback_requested', {
            fallback_reason: 'user',
            renderer: 'webgl',
            scene_ready: sceneReadyTrackedRef.current,
        });
        onUseListFallback?.();
    }, [onUseListFallback, track]);

    const closeOfferBrowser = useCallback(() => {
        void setSelectedOfferId(null);
        setFocusedBlockId(null);
        setHoveredOfferId(null);
        setOfferListOpen(false);
        window.requestAnimationFrame(() => {
            sceneContainerRef.current
                ?.querySelector<HTMLButtonElement>(
                    '[data-outlet-garden-list-trigger]',
                )
                ?.focus({ preventScroll: true });
        });
    }, [setSelectedOfferId]);

    const selectBlock = useCallback(
        (blockId: string) => {
            const offerId = outletOfferIdFromBlockId(blockId);
            if (offerId !== null) {
                selectOffer(offerId, blockId);
            }
        },
        [selectOffer],
    );

    return (
        <div
            className={`relative grid h-[100dvh] grid-cols-1 grid-rows-1 overflow-hidden bg-[#cfeaca] ${exitTarget ? 'motion-safe:animate-out motion-safe:fade-out-0 motion-safe:duration-200' : 'motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-500'}`}
            data-outlet-garden
            data-outlet-garden-avatar-view={visibleAvatarView}
            data-outlet-garden-display-count={displayUnits.length}
            data-outlet-garden-display-limited={displayLimited || undefined}
            data-outlet-garden-exiting={exitTarget ? true : undefined}
            data-outlet-garden-hovered-offer={hoveredOfferId ?? undefined}
            data-outlet-garden-renderer="webgl"
            data-outlet-garden-walking={avatarWalking || undefined}
        >
            <main
                aria-label="Interaktivni 3D prikaz Outlet vrta"
                className="relative min-h-0 overflow-hidden"
                ref={sceneContainerRef}
                tabIndex={focusOnMount ? -1 : undefined}
            >
                {sceneAvailable ? (
                    <PublicGardenViewer
                        appBaseUrl=""
                        cameraMinZoom={outletGardenCameraMinZoom}
                        className="size-full"
                        garden={outletGarden}
                        initialView={sceneInitialView}
                        interactiveBlockIds={
                            avatarWalking ? undefined : interactiveBlockIds
                        }
                        localVisitorActivationRequest={avatarActivationRequest}
                        localVisitorSpawnPoint={outletGardenVisitorSpawnPoint}
                        noWeather
                        onLocalVisitorViewChange={handleLocalVisitorViewChange}
                        onSelectBlock={avatarWalking ? undefined : selectBlock}
                        onSceneContextLost={reportSceneContextLost}
                        onSceneReady={trackSceneReady}
                        renderDetails={false}
                        renderGroundDecorations
                        sceneChildren={
                            <>
                                <OutletGardenSeedlingMarkers
                                    highlightedOfferId={hoveredOfferId}
                                    offers={sceneOffers}
                                    stacks={outletGarden.stacks}
                                />
                                <Suspense fallback={null}>
                                    <OutletGardenProductSigns
                                        offers={sceneOffers}
                                        placements={productSignPlacements}
                                        stacks={outletGarden.stacks}
                                    />
                                </Suspense>
                            </>
                        }
                        selectedBlockId={selectedBlockId}
                        selectedBlockFocus={
                            avatarWalking ? undefined : selectedBlockFocus
                        }
                        spriteBaseUrl=""
                        visitorPresence={outletLocalVisitorPresence}
                    />
                ) : (
                    <OutletGardenScenePlaceholder
                        label={
                            isError
                                ? 'Outlet vrt čeka ponovni pokušaj učitavanja.'
                                : sceneOffers.length === 0 && !isLoading
                                  ? 'Nove sadnice uskoro stižu u Outlet vrt.'
                                  : 'Teleportiramo te u Outlet vrt...'
                        }
                    />
                )}

                {!avatarWalking ? (
                    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 bg-linear-to-b from-black/25 to-transparent p-3 pb-10 sm:p-4">
                        <ButtonGreen
                            className="pointer-events-auto border border-lime-200/80 shadow-lg backdrop-blur dark:border-lime-800/80"
                            href="/"
                            onClick={(event) => {
                                event.preventDefault();
                                requestExit('garden', '/');
                            }}
                            size="lg"
                            startDecorator={<ArrowLeft className="size-4" />}
                        >
                            Moj vrt
                        </ButtonGreen>
                        <div className="pointer-events-auto flex items-start gap-2">
                            <ButtonGreen
                                className="border border-lime-200/80 shadow-lg backdrop-blur dark:border-lime-800/80"
                                aria-label="Prošetaj Outlet vrtom"
                                onClick={() => {
                                    setAvatarActivationRequest(
                                        (currentRequest) => currentRequest + 1,
                                    );
                                }}
                                size="lg"
                                startDecorator={
                                    <Footprints className="size-4" />
                                }
                            >
                                <span className="hidden sm:inline">
                                    Prošetaj vrtom
                                </span>
                            </ButtonGreen>
                            <ButtonGreen
                                className="border border-lime-200/80 shadow-lg backdrop-blur dark:border-lime-800/80"
                                aria-controls="outlet-garden-browser"
                                aria-expanded={offerListOpen}
                                aria-label="Prikaži popis Outlet ponuda"
                                data-outlet-garden-list-trigger
                                onClick={openOfferList}
                                size="lg"
                                startDecorator={
                                    <LayoutList className="size-4" />
                                }
                            >
                                Popis ponuda
                            </ButtonGreen>
                        </div>
                    </div>
                ) : null}

                {!avatarWalking ? (
                    <div className="pointer-events-none absolute bottom-[var(--game-safe-area-bottom,0px)] left-[var(--game-safe-area-left,0px)] z-10 flex items-end p-2">
                        <ControlsTooltipHud
                            mode="view"
                            offsetForItemsHud={false}
                        />
                    </div>
                ) : null}

                {selectedOffer && !avatarWalking ? (
                    <div className="pointer-events-none absolute bottom-3 left-3 z-10 hidden sm:block">
                        <div className="flex items-center gap-2 rounded-full bg-white/85 px-3 py-2 text-xs font-medium shadow-lg backdrop-blur">
                            <Sprout className="size-4 text-lime-800" />
                            Odabrano: {selectedOffer.plantSort.name}
                        </div>
                    </div>
                ) : null}
            </main>

            <GameModal
                className="max-h-[calc(100dvh-2rem)] gap-0 overflow-hidden p-0 md:max-w-3xl"
                hideClose
                hudLayer
                onOpenChange={(open) => {
                    if (!open) {
                        closeOfferBrowser();
                    }
                }}
                open={
                    !avatarWalking &&
                    (offerListOpen || selectedOfferId !== null)
                }
                title={offerListOpen ? 'Popis Outlet ponuda' : 'Outlet ponuda'}
            >
                <OutletGardenOfferBrowser
                    commerce={commerce}
                    displayLimited={displayLimited}
                    headerAction={
                        offerListOpen && onUseListFallback ? (
                            <Button
                                aria-label="Prikaži Outlet ponude bez 3D prikaza"
                                onClick={requestListFallback}
                                size="lg"
                                startDecorator={
                                    <LayoutList className="size-4" />
                                }
                                variant="plain"
                            >
                                Lagani prikaz bez 3D-a
                            </Button>
                        ) : undefined
                    }
                    isError={isError}
                    isLoading={isLoading}
                    offers={offers}
                    onClose={closeOfferBrowser}
                    onExit={requestExit}
                    onAuthenticationRequired={onAuthenticationRequired}
                    onHoverOffer={setHoveredOfferId}
                    onRetry={() => {
                        void refetch();
                    }}
                    onSelectOffer={selectOffer}
                    onShowOfferList={openOfferList}
                    selectedOfferId={selectedOfferId}
                    surface="modal"
                    view={offerListOpen ? 'list' : 'details'}
                />
            </GameModal>
        </div>
    );
}
