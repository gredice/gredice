'use client';

import { clientAuthenticated, type GardenResponse } from '@gredice/client';
import type { PublicGardenDetail } from '@gredice/game';
import { getGardenBaseUrl } from '@gredice/js/urls';
import { Card, CardContent } from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { IconButton } from '@gredice/ui/IconButton';
import {
    ArrowLeft,
    ArrowRight,
    Navigate,
    Pause,
    Play,
} from '@gredice/ui/icons';
import { NavigatingButton } from '@gredice/ui/NavigatingButton';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import { useQuery } from '@tanstack/react-query';
import type { FocusEvent, PointerEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { WinterModeToggle } from '../components/WinterModeToggle';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { KnownPages } from '../src/KnownPages';
import { LandingPublicGardenViewer } from './LandingPublicGardenViewer';
import {
    getAdjacentLandingGardenIndex,
    orderLandingGardens,
} from './landingGardenCarousel';

const autoplayDelayMs = 8_000;
const gardenTransitionDelayMs = 280;
const swipeThresholdPx = 44;
const noGardens: PublicGardenDetail[] = [];

function toPublicGardenDetail(garden: GardenResponse): PublicGardenDetail {
    return {
        backgroundPalette: garden.backgroundPalette,
        farmId: garden.farmId,
        homeCamera: garden.homeCamera,
        id: garden.id,
        isPublic: garden.isPublic,
        isSandbox: garden.isSandbox,
        latitude: garden.latitude,
        longitude: garden.longitude,
        name: garden.name,
        raisedBeds: garden.raisedBeds,
        stacks: garden.stacks,
        updatedAt: garden.updatedAt,
    };
}

async function getOwnedGardens() {
    const gardensResponse = await clientAuthenticated().api.gardens.$get();
    if (gardensResponse.status === 401) {
        return [];
    }
    if (!gardensResponse.ok) {
        throw new Error('Failed to load owned gardens.');
    }

    const gardens = await gardensResponse.json();
    const gardenDetails = await Promise.all(
        gardens.map(async (garden) => {
            const response = await clientAuthenticated().api.gardens[
                ':gardenId'
            ].$get({
                param: { gardenId: garden.id.toString() },
            });
            if (!response.ok) {
                return null;
            }

            return toPublicGardenDetail(await response.json());
        }),
    );

    return gardenDetails.filter((garden) => garden !== null);
}

function getOwnedGardenUrl(gardenId: number) {
    const url = new URL(getGardenBaseUrl());
    url.searchParams.set('vrt', gardenId.toString());
    return url.toString();
}

export function LandingFeaturedGardens({
    featuredGardens,
}: {
    featuredGardens: PublicGardenDetail[];
}) {
    const { data: user } = useCurrentUser();
    const ownedGardensQuery = useQuery({
        queryKey: ['landing', 'owned-gardens', user?.id],
        queryFn: getOwnedGardens,
        enabled: Boolean(user),
        retry: false,
        staleTime: 60 * 60 * 1000,
    });
    const ownedGardens = user
        ? (ownedGardensQuery.data ?? noGardens)
        : noGardens;
    const gardens = useMemo(
        () => orderLandingGardens(ownedGardens, featuredGardens),
        [featuredGardens, ownedGardens],
    );
    const [displayedGardenId, setDisplayedGardenId] = useState<number | null>(
        featuredGardens[0]?.id ?? null,
    );
    const [sceneVisible, setSceneVisible] = useState(true);
    const [autoplayPaused, setAutoplayPaused] = useState(false);
    const [interactionPaused, setInteractionPaused] = useState(false);
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
    const transitionTimeoutRef = useRef<number | null>(null);
    const transitionFrameRef = useRef<number | null>(null);
    const pendingGardenIdRef = useRef<number | null>(displayedGardenId);
    const promotedOwnedGardenIdRef = useRef<number | null>(null);
    const swipeStartRef = useRef<{ x: number; y: number } | null>(null);

    const showGarden = useCallback(
        (gardenId: number) => {
            if (
                gardenId === pendingGardenIdRef.current &&
                (gardenId !== displayedGardenId || sceneVisible)
            ) {
                return;
            }

            pendingGardenIdRef.current = gardenId;
            if (transitionTimeoutRef.current !== null) {
                window.clearTimeout(transitionTimeoutRef.current);
            }
            if (transitionFrameRef.current !== null) {
                window.cancelAnimationFrame(transitionFrameRef.current);
            }

            if (prefersReducedMotion) {
                setDisplayedGardenId(gardenId);
                setSceneVisible(true);
                return;
            }

            setSceneVisible(false);
            transitionTimeoutRef.current = window.setTimeout(() => {
                setDisplayedGardenId(pendingGardenIdRef.current);
                transitionFrameRef.current = window.requestAnimationFrame(
                    () => {
                        setSceneVisible(true);
                    },
                );
            }, gardenTransitionDelayMs);
        },
        [displayedGardenId, prefersReducedMotion, sceneVisible],
    );

    useEffect(() => {
        const mediaQuery = window.matchMedia(
            '(prefers-reduced-motion: reduce)',
        );
        const updatePreference = () =>
            setPrefersReducedMotion(mediaQuery.matches);

        updatePreference();
        mediaQuery.addEventListener('change', updatePreference);
        return () => mediaQuery.removeEventListener('change', updatePreference);
    }, []);

    useEffect(
        () => () => {
            if (transitionTimeoutRef.current !== null) {
                window.clearTimeout(transitionTimeoutRef.current);
            }
            if (transitionFrameRef.current !== null) {
                window.cancelAnimationFrame(transitionFrameRef.current);
            }
        },
        [],
    );

    useEffect(() => {
        const firstOwnedGardenId = ownedGardens[0]?.id;
        if (
            firstOwnedGardenId !== undefined &&
            promotedOwnedGardenIdRef.current !== firstOwnedGardenId
        ) {
            promotedOwnedGardenIdRef.current = firstOwnedGardenId;
            showGarden(firstOwnedGardenId);
            return;
        }

        if (
            gardens.length > 0 &&
            !gardens.some((item) => item.garden.id === displayedGardenId)
        ) {
            showGarden(gardens[0].garden.id);
        }
    }, [displayedGardenId, gardens, ownedGardens, showGarden]);

    const displayedGarden =
        gardens.find((item) => item.garden.id === displayedGardenId) ??
        gardens[0];
    const displayedGardenIndex = displayedGarden
        ? gardens.findIndex(
              (item) => item.garden.id === displayedGarden.garden.id,
          )
        : -1;

    const moveGarden = useCallback(
        (direction: -1 | 1) => {
            if (!displayedGarden || !sceneVisible) {
                return;
            }

            const adjacentIndex = getAdjacentLandingGardenIndex(
                displayedGardenIndex,
                gardens.length,
                direction,
            );
            const adjacentGarden = gardens[adjacentIndex];
            if (adjacentGarden) {
                showGarden(adjacentGarden.garden.id);
            }
        },
        [
            displayedGarden,
            displayedGardenIndex,
            gardens,
            sceneVisible,
            showGarden,
        ],
    );

    useEffect(() => {
        if (
            gardens.length < 2 ||
            autoplayPaused ||
            interactionPaused ||
            prefersReducedMotion ||
            !sceneVisible
        ) {
            return;
        }

        const timeout = window.setTimeout(() => moveGarden(1), autoplayDelayMs);
        return () => window.clearTimeout(timeout);
    }, [
        autoplayPaused,
        gardens.length,
        interactionPaused,
        moveGarden,
        prefersReducedMotion,
        sceneVisible,
    ]);

    const handleBlur = useCallback((event: FocusEvent<HTMLDivElement>) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
            setInteractionPaused(false);
        }
    }, []);

    const handlePointerDown = useCallback(
        (event: PointerEvent<HTMLDivElement>) => {
            if (event.pointerType === 'mouse' && event.button !== 0) {
                return;
            }

            event.currentTarget.setPointerCapture(event.pointerId);
            swipeStartRef.current = { x: event.clientX, y: event.clientY };
        },
        [],
    );

    const handlePointerUp = useCallback(
        (event: PointerEvent<HTMLDivElement>) => {
            const swipeStart = swipeStartRef.current;
            swipeStartRef.current = null;
            if (!swipeStart) {
                return;
            }

            const deltaX = event.clientX - swipeStart.x;
            const deltaY = event.clientY - swipeStart.y;
            if (
                Math.abs(deltaX) < swipeThresholdPx ||
                Math.abs(deltaX) <= Math.abs(deltaY)
            ) {
                return;
            }

            moveGarden(deltaX < 0 ? 1 : -1);
        },
        [moveGarden],
    );

    if (!displayedGarden) {
        return (
            <div className="flex size-full items-center justify-center bg-[#d9f2dc] px-6 text-center">
                <Typography level="body1">
                    Trenutno nema vrtova za prikaz.
                </Typography>
            </div>
        );
    }

    const selectedGardenHref =
        displayedGarden.source === 'owned'
            ? getOwnedGardenUrl(displayedGarden.garden.id)
            : KnownPages.PublicGarden(displayedGarden.garden.id);

    return (
        <section
            aria-label="Vrtovi korisnika Gredica"
            className="relative size-full touch-pan-y"
            data-garden-id={displayedGarden.garden.id}
            data-garden-source={displayedGarden.source}
            data-testid="landing-featured-gardens"
            onBlur={handleBlur}
            onFocusCapture={() => setInteractionPaused(true)}
            onPointerCancel={() => {
                swipeStartRef.current = null;
            }}
            onPointerDownCapture={handlePointerDown}
            onPointerEnter={() => setInteractionPaused(true)}
            onPointerLeave={() => setInteractionPaused(false)}
            onPointerUpCapture={handlePointerUp}
        >
            <div
                className={cx(
                    'absolute inset-0 transition-[opacity,transform,filter] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
                    sceneVisible
                        ? 'scale-100 opacity-100 blur-none'
                        : 'scale-[1.015] opacity-35 blur-[2px]',
                )}
                data-scene-visible={sceneVisible}
            >
                <LandingPublicGardenViewer
                    appBaseUrl={getGardenBaseUrl()}
                    className="size-full"
                    deferDetails
                    garden={displayedGarden.garden}
                    noControls
                    noSound
                />
            </div>

            <div className="pointer-events-none absolute top-8 right-8 left-8 z-10 sm:top-10 sm:right-10 sm:left-10 md:top-10 lg:top-12 lg:right-16 lg:left-16">
                <div className="flex items-start justify-between gap-4">
                    <Card
                        className="pointer-events-auto w-fit max-w-[21rem] rounded-[var(--landing-card-radius)] border-tertiary border-b-4 bg-card/95 backdrop-blur-sm sm:max-w-[26rem]"
                        data-testid="landing-hero-card"
                    >
                        <CardContent noHeader className="p-5 sm:p-6">
                            <Stack spacing={3}>
                                <Typography level="h3" component="h1">
                                    Vrtovi korisnika Gredica
                                </Typography>
                                <div className="flex flex-wrap items-center gap-2">
                                    <Typography level="body1" semiBold>
                                        {displayedGarden.garden.name}
                                    </Typography>
                                    <Chip
                                        color={
                                            displayedGarden.source === 'owned'
                                                ? 'success'
                                                : 'neutral'
                                        }
                                        size="sm"
                                        variant="soft"
                                    >
                                        {displayedGarden.source === 'owned'
                                            ? 'Tvoj vrt'
                                            : 'Istaknuti vrt'}
                                    </Chip>
                                </div>

                                {gardens.length > 1 ? (
                                    <fieldset className="m-0 flex items-center gap-2 border-0 p-0">
                                        <legend className="sr-only">
                                            Odaberi vrt
                                        </legend>
                                        <IconButton
                                            aria-label="Prethodni vrt"
                                            className="rounded-full"
                                            disabled={!sceneVisible}
                                            onClick={() => moveGarden(-1)}
                                            size="sm"
                                            variant="outlined"
                                        >
                                            <ArrowLeft
                                                aria-hidden
                                                className="size-4"
                                            />
                                        </IconButton>
                                        <div className="flex items-center gap-1.5">
                                            {gardens.map((item, index) => {
                                                const selected =
                                                    item.garden.id ===
                                                    displayedGarden.garden.id;
                                                return (
                                                    <button
                                                        aria-current={
                                                            selected
                                                                ? 'true'
                                                                : undefined
                                                        }
                                                        aria-label={`Prikaži vrt ${item.garden.name}`}
                                                        className={cx(
                                                            'size-2.5 rounded-full border border-primary/40 transition-[width,background-color] motion-reduce:transition-none',
                                                            selected
                                                                ? 'w-6 bg-primary'
                                                                : 'bg-background/80 hover:bg-primary/30',
                                                        )}
                                                        disabled={
                                                            !sceneVisible &&
                                                            !selected
                                                        }
                                                        key={item.garden.id}
                                                        onClick={() =>
                                                            showGarden(
                                                                item.garden.id,
                                                            )
                                                        }
                                                        title={`${(index + 1).toString()}. ${item.garden.name}`}
                                                        type="button"
                                                    />
                                                );
                                            })}
                                        </div>
                                        <IconButton
                                            aria-label="Sljedeći vrt"
                                            className="rounded-full"
                                            disabled={!sceneVisible}
                                            onClick={() => moveGarden(1)}
                                            size="sm"
                                            variant="outlined"
                                        >
                                            <ArrowRight
                                                aria-hidden
                                                className="size-4"
                                            />
                                        </IconButton>
                                        {!prefersReducedMotion ? (
                                            <IconButton
                                                aria-label={
                                                    autoplayPaused
                                                        ? 'Pokreni automatsku izmjenu vrtova'
                                                        : 'Zaustavi automatsku izmjenu vrtova'
                                                }
                                                className="rounded-full"
                                                onClick={() =>
                                                    setAutoplayPaused(
                                                        (paused) => !paused,
                                                    )
                                                }
                                                size="sm"
                                                variant="plain"
                                            >
                                                {autoplayPaused ? (
                                                    <Play
                                                        aria-hidden
                                                        className="size-4"
                                                    />
                                                ) : (
                                                    <Pause
                                                        aria-hidden
                                                        className="size-4"
                                                    />
                                                )}
                                            </IconButton>
                                        ) : null}
                                    </fieldset>
                                ) : null}
                            </Stack>
                        </CardContent>
                    </Card>
                    <WinterModeToggle />
                </div>
            </div>

            <div className="pointer-events-none absolute right-5 bottom-5 left-5 z-10 flex justify-center sm:right-8 sm:bottom-8 sm:left-auto">
                <NavigatingButton
                    className="pointer-events-auto rounded-full bg-background/95 text-primary shadow-lg backdrop-blur-sm"
                    color="neutral"
                    endDecorator={<Navigate aria-hidden className="size-4" />}
                    href={selectedGardenHref}
                    variant="outlined"
                >
                    {displayedGarden.source === 'owned'
                        ? 'Otvori moj vrt'
                        : 'Pogledaj vrt'}
                </NavigatingButton>
            </div>
        </section>
    );
}
