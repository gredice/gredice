'use client';

import { clientAuthenticated, type GardenResponse } from '@gredice/client';
import type { PublicGardenDetail } from '@gredice/game';
import {
    GardenSceneTransitionSurface,
    gardenSceneTransitionDelayMs,
} from '@gredice/game/garden-scene-transition';
import { getGardenBaseUrl } from '@gredice/js/urls';
import { Card, CardContent } from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { IconButton } from '@gredice/ui/IconButton';
import { Left, Navigate, Pause, Play } from '@gredice/ui/icons';
import { NavigatingButton } from '@gredice/ui/NavigatingButton';
import { Typography } from '@gredice/ui/Typography';
import { UserAvatar } from '@gredice/ui/UserAvatar';
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
    getVisibleLandingGardenIndexes,
    type LandingGardenCandidate,
    orderLandingGardens,
} from './landingGardenCarousel';

const autoplayDelayMs = 8_000;
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
        structures: garden.structures,
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
    featuredGardens: LandingGardenCandidate[];
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
    const gardens = useMemo(() => {
        const ownedGardenOwner = user
            ? {
                  avatarUrl: user.avatarUrl ?? null,
                  displayName: user.displayName ?? 'Korisnik Gredica',
              }
            : null;

        return orderLandingGardens(
            ownedGardens.map((garden) => ({
                garden,
                owner: ownedGardenOwner,
            })),
            featuredGardens,
        );
    }, [featuredGardens, ownedGardens, user]);
    const [displayedGardenId, setDisplayedGardenId] = useState<number | null>(
        featuredGardens[0]?.garden.id ?? null,
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
    const autoplayRemainingMsRef = useRef(autoplayDelayMs);
    const autoplayStartedAtRef = useRef<number | null>(null);
    const resetAutoplayCycle = useCallback(() => {
        autoplayRemainingMsRef.current = autoplayDelayMs;
        autoplayStartedAtRef.current = null;
    }, []);

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
                resetAutoplayCycle();
                setDisplayedGardenId(gardenId);
                setSceneVisible(true);
                return;
            }

            setSceneVisible(false);
            transitionTimeoutRef.current = window.setTimeout(() => {
                resetAutoplayCycle();
                setDisplayedGardenId(pendingGardenIdRef.current);
                transitionFrameRef.current = window.requestAnimationFrame(
                    () => {
                        setSceneVisible(true);
                    },
                );
            }, gardenSceneTransitionDelayMs);
        },
        [
            displayedGardenId,
            prefersReducedMotion,
            resetAutoplayCycle,
            sceneVisible,
        ],
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
    const visibleGardenIndexes = getVisibleLandingGardenIndexes(
        displayedGardenIndex,
        gardens.length,
    );

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

    const autoplayRunning =
        gardens.length > 1 &&
        !autoplayPaused &&
        !interactionPaused &&
        !prefersReducedMotion &&
        sceneVisible;

    useEffect(() => {
        if (!autoplayRunning) {
            return;
        }

        const startedAt = window.performance.now();
        autoplayStartedAtRef.current = startedAt;
        const timeout = window.setTimeout(() => {
            autoplayRemainingMsRef.current = autoplayDelayMs;
            autoplayStartedAtRef.current = null;
            moveGarden(1);
        }, autoplayRemainingMsRef.current);

        return () => {
            window.clearTimeout(timeout);
            if (autoplayStartedAtRef.current === startedAt) {
                autoplayRemainingMsRef.current = Math.max(
                    0,
                    autoplayRemainingMsRef.current -
                        (window.performance.now() - startedAt),
                );
                autoplayStartedAtRef.current = null;
            }
        };
    }, [autoplayRunning, moveGarden]);

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
            if (event.pointerType !== 'mouse') {
                setInteractionPaused(true);
            }
        },
        [],
    );

    const handlePointerUp = useCallback(
        (event: PointerEvent<HTMLDivElement>) => {
            const swipeStart = swipeStartRef.current;
            swipeStartRef.current = null;
            if (event.pointerType !== 'mouse') {
                setInteractionPaused(false);
            }
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
            onPointerEnter={() => setInteractionPaused(true)}
            onPointerLeave={() => setInteractionPaused(false)}
        >
            <GardenSceneTransitionSurface
                className="absolute inset-0"
                visible={sceneVisible}
                onPointerCancel={(event) => {
                    swipeStartRef.current = null;
                    if (event.pointerType !== 'mouse') {
                        setInteractionPaused(false);
                    }
                }}
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUp}
            >
                <LandingPublicGardenViewer
                    appBaseUrl={getGardenBaseUrl()}
                    className="size-full"
                    deferDetails
                    garden={displayedGarden.garden}
                    noControls
                    noSound
                />
            </GardenSceneTransitionSurface>

            <div className="pointer-events-none absolute right-3 bottom-3 left-3 z-10 md:top-10 md:right-10 md:bottom-auto md:left-10 lg:top-12 lg:right-16 lg:left-16">
                <Card
                    className="pointer-events-auto w-full rounded-2xl border-tertiary/70 bg-card/90 shadow-lg backdrop-blur-md md:w-fit md:max-w-[26rem] md:rounded-[var(--landing-card-radius)] md:border-tertiary md:border-b-4 md:bg-card/95 md:shadow-none"
                    data-testid="landing-hero-card"
                >
                    <CardContent noHeader className="p-3 md:p-6">
                        <div className="flex items-center gap-3 md:block">
                            <div className="min-w-0 flex-1">
                                <Typography
                                    className="text-xs font-medium tracking-wide text-tertiary-foreground uppercase md:text-3xl md:font-normal md:tracking-normal md:text-foreground md:normal-case"
                                    component="h1"
                                    level="h3"
                                >
                                    Vrtovi korisnika Gredica
                                </Typography>
                                <div className="mt-1 flex min-w-0 items-center gap-2 md:mt-3 md:flex-wrap md:gap-2.5">
                                    {displayedGarden.owner ? (
                                        <UserAvatar
                                            avatarUrl={
                                                displayedGarden.owner.avatarUrl
                                            }
                                            className="shrink-0 ring-2 ring-background"
                                            displayName={
                                                displayedGarden.owner
                                                    .displayName
                                            }
                                            size="sm"
                                        />
                                    ) : null}
                                    <Typography
                                        className="min-w-0"
                                        level="body1"
                                        noWrap
                                        semiBold
                                    >
                                        {displayedGarden.garden.name}
                                    </Typography>
                                    {displayedGarden.source === 'owned' ? (
                                        <Chip
                                            className="shrink-0"
                                            color="success"
                                            size="sm"
                                            variant="soft"
                                        >
                                            Tvoj vrt
                                        </Chip>
                                    ) : null}
                                </div>
                            </div>

                            <NavigatingButton
                                className="shrink-0 rounded-full bg-background/95 text-primary shadow-sm md:hidden"
                                color="neutral"
                                href={selectedGardenHref}
                                size="xs"
                                variant="outlined"
                            >
                                {displayedGarden.source === 'owned'
                                    ? 'Otvori'
                                    : 'Pogledaj'}
                            </NavigatingButton>
                        </div>

                        {gardens.length > 1 ? (
                            <fieldset className="m-0 mt-2 flex items-center justify-center gap-2 border-0 p-0 md:mt-3 md:justify-start">
                                <legend className="sr-only">Odaberi vrt</legend>
                                <IconButton
                                    aria-label="Prethodni vrt"
                                    className="rounded-full"
                                    disabled={!sceneVisible}
                                    onClick={() => moveGarden(-1)}
                                    size="sm"
                                    variant="plain"
                                >
                                    <Left aria-hidden className="size-4" />
                                </IconButton>
                                <div className="flex items-center gap-1.5">
                                    {visibleGardenIndexes.map((index) => {
                                        const item = gardens[index];
                                        if (!item) {
                                            return null;
                                        }

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
                                                    'relative h-2.5 overflow-hidden rounded-full border border-primary/40 transition-[width,background-color] motion-reduce:transition-none',
                                                    selected
                                                        ? 'w-8 bg-background/80'
                                                        : 'w-2.5 bg-background/80 hover:bg-primary/30',
                                                )}
                                                disabled={
                                                    !sceneVisible && !selected
                                                }
                                                key={item.garden.id}
                                                onClick={() =>
                                                    showGarden(item.garden.id)
                                                }
                                                title={`${(index + 1).toString()}. ${item.garden.name}`}
                                                type="button"
                                            >
                                                {selected ? (
                                                    <span
                                                        aria-hidden
                                                        className={cx(
                                                            'absolute inset-0 origin-left bg-primary',
                                                            prefersReducedMotion
                                                                ? 'scale-x-100'
                                                                : 'animate-landing-garden-progress',
                                                        )}
                                                        data-autoplay-state={
                                                            autoplayRunning
                                                                ? 'running'
                                                                : 'paused'
                                                        }
                                                        data-testid="landing-garden-progress"
                                                        style={
                                                            prefersReducedMotion
                                                                ? undefined
                                                                : {
                                                                      animationDuration: `${autoplayDelayMs.toString()}ms`,
                                                                      animationPlayState:
                                                                          autoplayRunning
                                                                              ? 'running'
                                                                              : 'paused',
                                                                  }
                                                        }
                                                    />
                                                ) : null}
                                            </button>
                                        );
                                    })}
                                </div>
                                <IconButton
                                    aria-label="Sljedeći vrt"
                                    className="rounded-full"
                                    disabled={!sceneVisible}
                                    onClick={() => moveGarden(1)}
                                    size="sm"
                                    variant="plain"
                                >
                                    <Navigate aria-hidden className="size-4" />
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
                    </CardContent>
                </Card>
            </div>

            <div className="pointer-events-auto absolute top-3 right-3 z-10 md:top-10 md:right-10 lg:top-12 lg:right-16">
                <WinterModeToggle />
            </div>

            <div className="pointer-events-none absolute right-8 bottom-8 z-10 hidden md:flex">
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
