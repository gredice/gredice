'use client';

import { isRaisedBedAbandoned } from '@gredice/js/raisedBeds';
import { firstRaisedBedTutorialTasks } from '@gredice/js/raisedBedTutorial';
import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { Chip } from '@gredice/ui/Chip';
import { IconButton } from '@gredice/ui/IconButton';
import {
    Check,
    ExternalLink,
    Info,
    Left,
    Navigate,
    ShoppingCart,
    Sprout,
} from '@gredice/ui/icons';
import { PlantOrSortImage } from '@gredice/ui/plants';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import {
    type PointerEvent as ReactPointerEvent,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { useGameAnalytics } from '../analytics/GameAnalyticsContext';
import { useCurrentGarden } from '../hooks/useCurrentGarden';
import { useAllSorts } from '../hooks/usePlantSorts';
import { useSetShoppingCartItem } from '../hooks/useSetShoppingCartItem';
import {
    type ShoppingCartData,
    useShoppingCart,
} from '../hooks/useShoppingCart';
import {
    scheduleHideShoppingCartTransientHub,
    showShoppingCartTransientHub,
} from '../hooks/useShoppingCartTransientHub';
import { KnownPages } from '../knownPages';
import { GameModal } from '../shared-ui/game-modal';
import { useGameState } from '../useGameState';
import { useSetRaisedBedCloseupParam } from '../useRaisedBedCloseup';
import { isRaisedBedFieldOccupied } from '../utils/raisedBedFields';
import { HudCard } from './components/HudCard';
import styles from './RaisedBedOnboardingModal.module.css';
import {
    getRaisedBedOnboardingLayouts,
    type RaisedBedOnboardingCare,
    type RaisedBedOnboardingGoal,
    type RaisedBedOnboardingLayout,
    raisedBedOnboardingCareOptions,
    raisedBedOnboardingGoals,
    resolveRaisedBedOnboardingCrops,
} from './raisedBedOnboardingLayouts';

const DISMISSED_STORAGE_VERSION = 1;
const SUGGESTION_CARD_ANIMATION_MS = 360;

type RaisedBedOnboardingModalProps = {
    enabled: boolean;
    autoOpen?: boolean;
    onApplied?: () => void;
    onResolved?: () => void;
    showTrigger?: boolean;
};

export const RAISED_BED_ONBOARDING_OPEN_EVENT =
    'game:raised-bed-onboarding:open';

type RaisedBedOnboardingStep = 'goal' | 'care' | 'layouts' | 'tasks';
type WizardStepDirection = 'forward' | 'backward';

const onboardingSteps: {
    id: RaisedBedOnboardingStep;
    label: string;
}[] = [
    { id: 'goal', label: 'Odabir' },
    { id: 'care', label: 'Ritam' },
    { id: 'layouts', label: 'Raspored' },
    { id: 'tasks', label: 'Koraci' },
];

const firstRaisedBedOnboardingTaskIds = [
    'choose-meals',
    'choose-care-rhythm',
    'review-layouts',
    'add-plan-to-cart',
    'customize-empty-fields',
    'confirm-cart',
];

const firstRaisedBedOnboardingTasks = firstRaisedBedOnboardingTaskIds.flatMap(
    (taskId) => {
        const task = firstRaisedBedTutorialTasks.find(
            (item) => item.id === taskId,
        );
        return task ? [task] : [];
    },
);

function dismissedStorageKey(gardenId: number) {
    return `game:raised-bed-onboarding:v${DISMISSED_STORAGE_VERSION}:garden:${gardenId.toString()}`;
}

function readDismissed(key: string | null) {
    if (!key || typeof window === 'undefined') {
        return true;
    }

    return window.localStorage.getItem(key) === '1';
}

function writeDismissed(key: string | null) {
    if (!key || typeof window === 'undefined') {
        return;
    }

    window.localStorage.setItem(key, '1');
}

function tomorrowDate() {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
}

function positionLabel(positionIndex: number) {
    return (positionIndex + 1).toString();
}

function cropCounts(layout: RaisedBedOnboardingLayout) {
    const counts = new Map<string, { count: number; label: string }>();

    for (const placement of layout.placements) {
        const key = placement.cropDetails.key;
        const current = counts.get(key);
        counts.set(key, {
            count: (current?.count ?? 0) + 1,
            label: placement.cropDetails.label,
        });
    }

    return Array.from(counts.values());
}

function hasRaisedBedCartActivity(
    cart: ShoppingCartData | null | undefined,
    gardenId: number,
) {
    return Boolean(
        cart?.items.some(
            (item) =>
                item.entityTypeName === 'plantSort' &&
                item.gardenId === gardenId &&
                typeof item.raisedBedId === 'number',
        ),
    );
}

function LayoutGrid({
    compact,
    layout,
    selected,
}: {
    compact?: boolean;
    layout: RaisedBedOnboardingLayout;
    selected?: boolean;
}) {
    const placementsByPosition = new Map(
        layout.placements.map((placement) => [
            placement.positionIndex,
            placement,
        ]),
    );

    return (
        <div
            aria-hidden="true"
            className={cx(
                'grid grid-cols-3 gap-1 rounded-xl border border-[#dec49a] bg-[#8a6245] p-2 shadow-inner dark:border-[#9a6d49] dark:bg-[#4a2f20]',
                compact ? 'w-28' : 'mx-auto w-full max-w-64 gap-1.5 p-2.5',
                selected &&
                    'border-[#e8cf9e] bg-[#7a553d] dark:border-[#7e5b3f] dark:bg-[#3a2418]',
            )}
            data-raised-bed-onboarding-layout-grid={
                selected ? 'selected' : 'preview'
            }
        >
            {Array.from({ length: 18 }, (_, visualIndex) => {
                const row = Math.floor(visualIndex / 3);
                const col = visualIndex % 3;
                const positionIndex = row * 3 + col;
                const placement = placementsByPosition.get(positionIndex);

                return (
                    <div
                        className={cx(
                            'relative flex aspect-square min-w-0 items-center justify-center overflow-hidden rounded-md border text-[10px] font-semibold leading-none',
                            placement
                                ? 'border-[#d8c194]/70 bg-[#cadb9a] dark:border-[#b4986f]/60 dark:bg-[#a9bd72]'
                                : 'border-dashed border-[#d1ad7f]/35 bg-[#4f321f] dark:border-[#7a553d]/50 dark:bg-[#1f120c]',
                        )}
                        key={positionIndex}
                        title={
                            placement
                                ? `${placement.cropDetails.sortName} · polje ${positionLabel(positionIndex)}`
                                : 'Prazno za kasnije'
                        }
                    >
                        {placement ? (
                            <PlantOrSortImage
                                alt={placement.cropDetails.sortName}
                                className="object-cover"
                                fill
                                plantSort={placement.cropDetails.sort}
                                sizes={compact ? '44px' : '76px'}
                            />
                        ) : null}
                    </div>
                );
            })}
        </div>
    );
}

function StepProgress({ step }: { step: RaisedBedOnboardingStep }) {
    const currentIndex = onboardingSteps.findIndex((item) => item.id === step);

    return (
        <div
            aria-label={`Korak ${(currentIndex + 1).toString()} od ${onboardingSteps.length.toString()}`}
            className="flex w-32 items-center gap-1"
            data-raised-bed-onboarding-progress="true"
            role="progressbar"
            aria-valuemax={onboardingSteps.length}
            aria-valuemin={1}
            aria-valuenow={currentIndex + 1}
        >
            {onboardingSteps.map((item, index) => {
                return (
                    <span
                        className={cx(
                            'h-1 flex-1 rounded-full transition-colors',
                            index <= currentIndex
                                ? 'bg-green-600'
                                : 'bg-green-100 dark:bg-green-950',
                        )}
                        key={item.id}
                    />
                );
            })}
        </div>
    );
}

function onboardingStepIndex(step: RaisedBedOnboardingStep) {
    return onboardingSteps.findIndex((item) => item.id === step);
}

function onboardingStepAnalyticsProperties(step: RaisedBedOnboardingStep) {
    const stepIndex = onboardingStepIndex(step);

    return {
        step_id: step,
        step_index: stepIndex + 1,
        step_count: onboardingSteps.length,
        step_label: onboardingSteps[stepIndex]?.label,
        progress_percent: Math.round(
            ((stepIndex + 1) / onboardingSteps.length) * 100,
        ),
    };
}

function LayoutSuggestionCard({
    active,
    direction,
    layout,
    motion,
    onNext,
    onPrevious,
    showCardNavigation,
}: {
    active?: boolean;
    direction: 'next' | 'previous';
    layout: RaisedBedOnboardingLayout;
    motion: 'exit' | 'idle';
    onNext?: () => void;
    onPrevious?: () => void;
    showCardNavigation?: boolean;
}) {
    return (
        <div
            className={cx(
                'grid w-full gap-4 rounded-lg border border-green-200 bg-white p-4 text-left shadow-lg md:grid-cols-[minmax(0,1fr)_16rem] md:items-center dark:border-green-800/60 dark:bg-slate-950/45 dark:text-slate-100 dark:shadow-black/30',
                styles.layoutSuggestionCard,
            )}
            data-card-motion={motion}
            data-carousel-direction={direction}
            data-raised-bed-onboarding-suggestion-card={
                active ? 'true' : undefined
            }
        >
            <Stack spacing={3} className="min-w-0">
                <Row
                    alignItems="start"
                    justifyContent="space-between"
                    spacing={3}
                >
                    <Stack spacing={1} className="min-w-0">
                        <Typography className="text-lg leading-tight" semiBold>
                            {layout.title}
                        </Typography>
                        <Typography level="body3" secondary>
                            {layout.subtitle}
                        </Typography>
                    </Stack>
                    {showCardNavigation ? (
                        <Row
                            className={styles.layoutCardNavigation}
                            spacing={1}
                        >
                            <IconButton
                                className={styles.layoutCardNavigationButton}
                                onClick={onPrevious}
                                size="sm"
                                title="Prethodni prijedlog"
                                variant="outlined"
                            >
                                <Left className="size-5" />
                            </IconButton>
                            <IconButton
                                className={styles.layoutCardNavigationButton}
                                onClick={onNext}
                                size="sm"
                                title="Sljedeći prijedlog"
                                variant="outlined"
                            >
                                <Navigate className="size-5" />
                            </IconButton>
                        </Row>
                    ) : null}
                </Row>
                <div className="flex flex-wrap gap-1.5">
                    {layout.highlights.map((highlight) => (
                        <Chip key={highlight} size="sm" variant="soft">
                            {highlight}
                        </Chip>
                    ))}
                </div>
                <div className="flex flex-wrap gap-1.5">
                    {cropCounts(layout).map((item) => (
                        <Chip
                            key={item.label}
                            color="success"
                            size="sm"
                            variant="soft"
                        >
                            {item.label} x{item.count.toString()}
                        </Chip>
                    ))}
                </div>
            </Stack>
            <LayoutGrid layout={layout} selected />
        </div>
    );
}

function LayoutSuggestionCarousel({
    direction,
    layout,
    layoutCount,
    onNext,
    onPrevious,
}: {
    direction: 'next' | 'previous';
    layout: RaisedBedOnboardingLayout;
    layoutCount: number;
    onNext: () => void;
    onPrevious: () => void;
}) {
    const multipleLayouts = layoutCount > 1;
    const [activeLayout, setActiveLayout] = useState(layout);
    const [exitingLayout, setExitingLayout] =
        useState<RaisedBedOnboardingLayout | null>(null);
    const [transitionDirection, setTransitionDirection] = useState(direction);
    const exitTimerRef = useRef<number | null>(null);
    const swipeStartRef = useRef<{
        pointerId: number;
        x: number;
        y: number;
    } | null>(null);

    useEffect(() => {
        if (layout.id === activeLayout.id) {
            return;
        }

        if (exitTimerRef.current) {
            window.clearTimeout(exitTimerRef.current);
        }

        setTransitionDirection(direction);
        setExitingLayout(activeLayout);
        setActiveLayout(layout);
        exitTimerRef.current = window.setTimeout(() => {
            setExitingLayout(null);
            exitTimerRef.current = null;
        }, SUGGESTION_CARD_ANIMATION_MS);
    }, [activeLayout, direction, layout]);

    useEffect(() => {
        return () => {
            if (exitTimerRef.current) {
                window.clearTimeout(exitTimerRef.current);
            }
        };
    }, []);

    function releaseSwipePointer(event: ReactPointerEvent<HTMLDivElement>) {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        swipeStartRef.current = null;
    }

    function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
        if (!multipleLayouts) {
            return;
        }

        if (
            event.target instanceof Element &&
            event.target.closest('button, a')
        ) {
            return;
        }

        try {
            event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
            // Synthetic pointer events in tests may not have an active pointer.
        }
        swipeStartRef.current = {
            pointerId: event.pointerId,
            x: event.clientX,
            y: event.clientY,
        };
    }

    function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
        const swipeStart = swipeStartRef.current;
        if (!swipeStart || swipeStart.pointerId !== event.pointerId) {
            return;
        }

        const deltaX = event.clientX - swipeStart.x;
        const deltaY = event.clientY - swipeStart.y;
        const absoluteDeltaX = Math.abs(deltaX);
        const absoluteDeltaY = Math.abs(deltaY);
        releaseSwipePointer(event);

        if (absoluteDeltaX < 48 || absoluteDeltaX <= absoluteDeltaY) {
            return;
        }

        if (deltaX < 0) {
            onNext();
            return;
        }

        onPrevious();
    }

    return (
        <Stack
            alignItems="center"
            className="w-full max-w-3xl"
            data-raised-bed-onboarding-suggestion-carousel="true"
            spacing={3}
        >
            <div className={styles.layoutStack}>
                {multipleLayouts ? (
                    <>
                        <div
                            aria-hidden="true"
                            className={cx(
                                styles.layoutStackBack,
                                styles.layoutStackBackOne,
                            )}
                            data-raised-bed-onboarding-stack-card="back-1"
                        />
                        <div
                            aria-hidden="true"
                            className={cx(
                                styles.layoutStackBack,
                                styles.layoutStackBackTwo,
                            )}
                            data-raised-bed-onboarding-stack-card="back-2"
                        />
                    </>
                ) : null}
                <div
                    className={styles.layoutSuggestionStage}
                    data-raised-bed-onboarding-suggestion-stage="true"
                    onPointerCancel={releaseSwipePointer}
                    onPointerDown={handlePointerDown}
                    onPointerUp={handlePointerUp}
                >
                    {exitingLayout ? (
                        <LayoutSuggestionCard
                            direction={transitionDirection}
                            key={`exit-${exitingLayout.id}-${activeLayout.id}`}
                            layout={exitingLayout}
                            motion="exit"
                        />
                    ) : null}
                    <LayoutSuggestionCard
                        active
                        direction={transitionDirection}
                        key={`active-${activeLayout.id}`}
                        layout={activeLayout}
                        motion="idle"
                        onNext={onNext}
                        onPrevious={onPrevious}
                        showCardNavigation={multipleLayouts}
                    />
                </div>
                {multipleLayouts ? (
                    <>
                        <IconButton
                            className={cx(
                                styles.layoutCarouselButton,
                                styles.layoutCarouselButtonPrevious,
                            )}
                            onClick={onPrevious}
                            size="lg"
                            title="Prethodni prijedlog"
                            variant="outlined"
                        >
                            <Left className="size-6" />
                        </IconButton>
                        <IconButton
                            className={cx(
                                styles.layoutCarouselButton,
                                styles.layoutCarouselButtonNext,
                            )}
                            onClick={onNext}
                            size="lg"
                            title="Sljedeći prijedlog"
                            variant="outlined"
                        >
                            <Navigate className="size-6" />
                        </IconButton>
                    </>
                ) : null}
            </div>
        </Stack>
    );
}

export function RaisedBedOnboardingModal({
    autoOpen,
    enabled,
    onApplied,
    onResolved,
    showTrigger,
}: RaisedBedOnboardingModalProps) {
    const { track } = useGameAnalytics();
    const gardenQuery = useCurrentGarden();
    const sortsQuery = useAllSorts();
    const cartQuery = useShoppingCart(enabled);
    const setCartItem = useSetShoppingCartItem();
    const setView = useGameState((state) => state.setView);
    const setRaisedBedCloseupParam = useSetRaisedBedCloseupParam();
    const [goal, setGoal] = useState<RaisedBedOnboardingGoal>('salads');
    const [care, setCare] = useState<RaisedBedOnboardingCare>('balanced');
    const [step, setStep] = useState<RaisedBedOnboardingStep>('goal');
    const [stepDirection, setStepDirection] =
        useState<WizardStepDirection>('forward');
    const [selectedLayoutId, setSelectedLayoutId] = useState<string | null>(
        null,
    );
    const [layoutCarouselDirection, setLayoutCarouselDirection] = useState<
        'next' | 'previous'
    >('next');
    const [open, setOpen] = useState(false);
    const [dismissedSnapshot, setDismissedSnapshot] = useState<{
        dismissed: boolean;
        key: string | null;
    }>({ dismissed: true, key: null });
    const [applyError, setApplyError] = useState<string | null>(null);
    const [isApplying, setIsApplying] = useState(false);
    const resolvedRef = useRef(false);
    const openedRef = useRef(false);
    const lastTrackedStepViewRef = useRef<string | null>(null);
    const currentGarden = gardenQuery.data;
    const dismissedKey = currentGarden?.id
        ? dismissedStorageKey(currentGarden.id)
        : null;
    const dismissedReady =
        !dismissedKey || dismissedSnapshot.key === dismissedKey;
    const dismissed =
        dismissedSnapshot.key === dismissedKey
            ? dismissedSnapshot.dismissed
            : true;
    const shouldAutoOpen = autoOpen ?? enabled;

    const crops = useMemo(
        () => resolveRaisedBedOnboardingCrops(sortsQuery.data),
        [sortsQuery.data],
    );
    const layouts = useMemo(
        () => getRaisedBedOnboardingLayouts({ care, crops, goal }),
        [care, crops, goal],
    );
    const selectedLayout =
        layouts.find((layout) => layout.id === selectedLayoutId) ??
        layouts[0] ??
        null;
    const selectedLayoutIndex = Math.max(
        0,
        selectedLayout
            ? layouts.findIndex((layout) => layout.id === selectedLayout.id)
            : 0,
    );

    const targetRaisedBed = useMemo(() => {
        if (!currentGarden || currentGarden.isSandbox) {
            return null;
        }

        const hasPlantedFields = currentGarden.raisedBeds.some((raisedBed) =>
            raisedBed.fields.some((field) => isRaisedBedFieldOccupied(field)),
        );
        if (
            hasPlantedFields ||
            hasRaisedBedCartActivity(cartQuery.data, currentGarden.id)
        ) {
            return null;
        }

        return (
            currentGarden.raisedBeds.find(
                (raisedBed) => !isRaisedBedAbandoned(raisedBed.status),
            ) ?? null
        );
    }, [cartQuery.data, currentGarden]);

    const targetBlock = useMemo(() => {
        if (!currentGarden || !targetRaisedBed) {
            return null;
        }

        return (
            currentGarden.stacks
                .flatMap((stack) => stack.blocks)
                .find(
                    (block) =>
                        String(block.id) === String(targetRaisedBed.blockId),
                ) ?? null
        );
    }, [currentGarden, targetRaisedBed]);

    const onboardingAnalyticsProperties = useCallback(
        (analyticsStep: RaisedBedOnboardingStep = step) => {
            const layoutIndex =
                selectedLayout && layouts.length > 0
                    ? layouts.findIndex(
                          (layout) => layout.id === selectedLayout.id,
                      )
                    : -1;

            return {
                garden_id: currentGarden?.id,
                raised_bed_id: targetRaisedBed?.id,
                goal,
                care,
                layout_id: selectedLayout?.id,
                layout_index: layoutIndex >= 0 ? layoutIndex + 1 : undefined,
                layout_count: layouts.length || undefined,
                ...onboardingStepAnalyticsProperties(analyticsStep),
            };
        },
        [
            care,
            currentGarden?.id,
            goal,
            layouts,
            selectedLayout,
            step,
            targetRaisedBed?.id,
        ],
    );

    const dataReady =
        gardenQuery.isFetched &&
        sortsQuery.isFetched &&
        cartQuery.isFetched &&
        dismissedReady &&
        !gardenQuery.isFetching &&
        !sortsQuery.isFetching &&
        !cartQuery.isFetching;
    const canRenderOnboarding = Boolean(
        enabled &&
            dataReady &&
            targetRaisedBed &&
            targetBlock &&
            layouts.length > 0,
    );
    const canAutoOpenOnboarding = canRenderOnboarding && !dismissed;

    const reportResolved = useCallback(() => {
        if (resolvedRef.current) {
            return;
        }

        resolvedRef.current = true;
        onResolved?.();
    }, [onResolved]);

    const focusRaisedBed = useCallback(() => {
        if (!targetRaisedBed || !targetBlock) {
            return;
        }

        setView({ view: 'closeup', block: targetBlock });
        if (targetRaisedBed.name?.trim()) {
            setRaisedBedCloseupParam.mutate(targetRaisedBed.name);
        }
    }, [setRaisedBedCloseupParam, setView, targetBlock, targetRaisedBed]);

    const dismiss = useCallback(
        (source: 'applied' | 'closed') => {
            const analyticsProperties = onboardingAnalyticsProperties();
            writeDismissed(dismissedKey);
            setDismissedSnapshot({ dismissed: true, key: dismissedKey });
            setOpen(false);
            focusRaisedBed();
            track('game_raised_bed_onboarding_dismissed', {
                ...analyticsProperties,
                source,
            });
            if (source === 'closed') {
                track('game_raised_bed_onboarding_closed', {
                    ...analyticsProperties,
                    abandoned_step_id: analyticsProperties.step_id,
                    abandoned_step_index: analyticsProperties.step_index,
                    abandoned_step_label: analyticsProperties.step_label,
                });
            }
            reportResolved();
        },
        [
            dismissedKey,
            focusRaisedBed,
            onboardingAnalyticsProperties,
            reportResolved,
            track,
        ],
    );

    useEffect(() => {
        resolvedRef.current = false;
        openedRef.current = false;
        setDismissedSnapshot({
            dismissed: readDismissed(dismissedKey),
            key: dismissedKey,
        });
        setOpen(false);
        setStep('goal');
        setStepDirection('forward');
        setApplyError(null);
        setLayoutCarouselDirection('next');
        setSelectedLayoutId(null);
        lastTrackedStepViewRef.current = null;
    }, [dismissedKey]);

    useEffect(() => {
        if (!enabled || !dataReady) {
            return;
        }

        if (!shouldAutoOpen) {
            return;
        }

        if (!canAutoOpenOnboarding) {
            reportResolved();
            return;
        }

        setOpen(true);
        if (!openedRef.current) {
            openedRef.current = true;
            track('game_raised_bed_onboarding_opened', {
                ...onboardingAnalyticsProperties('goal'),
                source: 'auto',
            });
        }
    }, [
        canAutoOpenOnboarding,
        dataReady,
        enabled,
        onboardingAnalyticsProperties,
        reportResolved,
        shouldAutoOpen,
        track,
    ]);

    useEffect(() => {
        setLayoutCarouselDirection('next');
        setSelectedLayoutId(layouts[0]?.id ?? null);
    }, [layouts]);

    useEffect(() => {
        if (!open || !canRenderOnboarding) {
            lastTrackedStepViewRef.current = null;
            return;
        }

        const stepViewKey = `${dismissedKey ?? 'onboarding'}:${step}`;
        if (lastTrackedStepViewRef.current === stepViewKey) {
            return;
        }

        lastTrackedStepViewRef.current = stepViewKey;
        track('game_raised_bed_onboarding_step_viewed', {
            ...onboardingAnalyticsProperties(),
        });
    }, [
        canRenderOnboarding,
        dismissedKey,
        onboardingAnalyticsProperties,
        open,
        step,
        track,
    ]);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        function openFromTutorial() {
            if (!enabled || !canRenderOnboarding) {
                return;
            }

            setStepDirection('forward');
            setStep('goal');
            setApplyError(null);
            setOpen(true);
            track('game_raised_bed_onboarding_opened', {
                ...onboardingAnalyticsProperties('goal'),
                source: 'tutorial',
            });
        }

        window.addEventListener(
            RAISED_BED_ONBOARDING_OPEN_EVENT,
            openFromTutorial,
        );
        return () =>
            window.removeEventListener(
                RAISED_BED_ONBOARDING_OPEN_EVENT,
                openFromTutorial,
            );
    }, [canRenderOnboarding, enabled, onboardingAnalyticsProperties, track]);

    function selectLayoutAtIndex(
        nextIndex: number,
        direction: 'next' | 'previous',
    ) {
        if (layouts.length === 0) {
            return;
        }

        const normalizedIndex = (nextIndex + layouts.length) % layouts.length;
        const nextLayout = layouts[normalizedIndex];
        setLayoutCarouselDirection(direction);
        setSelectedLayoutId(nextLayout?.id ?? null);
        track('game_raised_bed_onboarding_layout_viewed', {
            ...onboardingAnalyticsProperties('layouts'),
            direction,
            layout_id: nextLayout?.id,
            layout_index: normalizedIndex + 1,
            layout_count: layouts.length,
        });
    }

    function goToStep(nextStep: RaisedBedOnboardingStep) {
        const direction =
            onboardingStepIndex(nextStep) < onboardingStepIndex(step)
                ? 'backward'
                : 'forward';
        track('game_raised_bed_onboarding_step_changed', {
            ...onboardingAnalyticsProperties(step),
            direction,
            from_step_id: step,
            from_step_index: onboardingStepAnalyticsProperties(step).step_index,
            to_step_id: nextStep,
            to_step_index:
                onboardingStepAnalyticsProperties(nextStep).step_index,
        });
        setStepDirection(direction);
        setStep(nextStep);
    }

    async function applyLayout() {
        if (!currentGarden || !targetRaisedBed || !selectedLayout) {
            return;
        }

        setApplyError(null);
        setIsApplying(true);
        showShoppingCartTransientHub();

        try {
            const scheduledDate = tomorrowDate().toISOString();
            const existingItems =
                cartQuery.data?.items.filter(
                    (item) =>
                        item.entityTypeName === 'plantSort' &&
                        item.gardenId === currentGarden.id &&
                        item.raisedBedId === targetRaisedBed.id &&
                        typeof item.positionIndex === 'number',
                ) ?? [];
            const selectedPositionIndices = new Set(
                selectedLayout.placements.map(
                    (placement) => placement.positionIndex,
                ),
            );

            for (const item of existingItems) {
                if (
                    typeof item.positionIndex === 'number' &&
                    selectedPositionIndices.has(item.positionIndex)
                ) {
                    await setCartItem.mutateAsync({
                        ...item,
                        gardenId: item.gardenId ?? undefined,
                        raisedBedId: item.raisedBedId ?? undefined,
                        positionIndex: item.positionIndex,
                        amount: 0,
                    });
                }
            }

            for (const placement of selectedLayout.placements) {
                await setCartItem.mutateAsync({
                    entityTypeName: 'plantSort',
                    entityId: placement.cropDetails.sortId.toString(),
                    amount: 1,
                    gardenId: currentGarden.id,
                    raisedBedId: targetRaisedBed.id,
                    positionIndex: placement.positionIndex,
                    additionalData: JSON.stringify({ scheduledDate }),
                    currency: 'eur',
                });
            }

            track('game_raised_bed_onboarding_applied', {
                ...onboardingAnalyticsProperties('tasks'),
                garden_id: currentGarden.id,
                layout_id: selectedLayout.id,
                raised_bed_id: targetRaisedBed.id,
                planted_fields: selectedLayout.placements.length,
            });
            onApplied?.();
            dismiss('applied');
        } catch (error) {
            console.error(
                'Failed to apply raised bed onboarding layout:',
                error,
            );
            setApplyError(
                'Plan sadnje nije dodan u košaru. Pokušaj ponovno ili nastavi ručno.',
            );
        } finally {
            scheduleHideShoppingCartTransientHub();
            setIsApplying(false);
        }
    }

    if (
        !enabled ||
        !dataReady ||
        !targetRaisedBed ||
        !targetBlock ||
        layouts.length === 0
    ) {
        return null;
    }

    const previousStep =
        step === 'care'
            ? 'goal'
            : step === 'layouts'
              ? 'care'
              : step === 'tasks'
                ? 'layouts'
                : null;

    const onboardingActions = (
        <div
            className="grid w-full max-w-sm grid-cols-[2.75rem_minmax(0,auto)_2.75rem] items-center justify-center gap-3"
            data-raised-bed-onboarding-actions="true"
        >
            {previousStep ? (
                <IconButton
                    className="justify-self-start text-muted-foreground hover:text-foreground"
                    disabled={isApplying}
                    onClick={() => goToStep(previousStep)}
                    title="Natrag"
                    variant="plain"
                >
                    <Left className="size-5" />
                </IconButton>
            ) : (
                <span aria-hidden="true" />
            )}
            <div className="justify-self-center">
                {step === 'goal' ? (
                    <Button
                        className="min-w-36 bg-green-700 px-6 font-semibold text-white hover:bg-green-800"
                        endDecorator={<Navigate className="size-5" />}
                        onClick={() => goToStep('care')}
                        size="lg"
                    >
                        Dalje
                    </Button>
                ) : null}
                {step === 'care' ? (
                    <Button
                        className="min-w-44 bg-green-700 px-6 font-semibold text-white hover:bg-green-800"
                        endDecorator={<Navigate className="size-5" />}
                        onClick={() => goToStep('layouts')}
                        size="lg"
                    >
                        Prikaži prijedloge
                    </Button>
                ) : null}
                {step === 'layouts' ? (
                    <Button
                        className="min-w-36 bg-green-700 px-6 font-semibold text-white hover:bg-green-800"
                        disabled={!selectedLayout}
                        endDecorator={<Navigate className="size-5" />}
                        onClick={() => goToStep('tasks')}
                        size="lg"
                    >
                        Dalje
                    </Button>
                ) : null}
                {step === 'tasks' ? (
                    <Button
                        className="min-w-52 bg-green-700 px-6 font-semibold text-white hover:bg-green-800"
                        disabled={!selectedLayout}
                        loading={isApplying}
                        onClick={applyLayout}
                        size="lg"
                        startDecorator={<ShoppingCart className="size-4" />}
                    >
                        Dodaj plan u košaru
                    </Button>
                ) : null}
            </div>
            <span aria-hidden="true" />
        </div>
    );

    const modal = (
        <GameModal
            title="Brzi plan gredice"
            open={open}
            onOpenChange={(nextOpen) => {
                if (nextOpen) {
                    setOpen(true);
                    track('game_raised_bed_onboarding_opened', {
                        ...onboardingAnalyticsProperties(),
                        source: 'trigger',
                    });
                    return;
                }
                if (!nextOpen) {
                    dismiss('closed');
                }
            }}
            trigger={
                showTrigger ? (
                    <Button
                        className="relative rounded-full p-2 gap-2"
                        data-raised-bed-onboarding-trigger="true"
                        startDecorator={<Sprout className="size-4 shrink-0" />}
                        title="Otvori vodič za prvu gredicu"
                        variant="plain"
                    >
                        <Typography
                            level="body2"
                            semiBold
                            className="relative z-10 text-foreground"
                        >
                            Prva gredica
                        </Typography>
                    </Button>
                ) : undefined
            }
            disableMobile
            overlayClassName="bg-black/45 backdrop-blur-md"
            className="!inset-0 !h-dvh !max-h-dvh !w-screen !max-w-none !translate-x-0 !translate-y-0 !overflow-hidden !rounded-none !border-0 !p-0 md:!inset-auto md:!left-1/2 md:!top-1/2 md:!h-[calc(100dvh-2rem)] md:!w-[calc(100vw-1.5rem)] md:!max-w-none md:!-translate-x-1/2 md:!-translate-y-1/2 md:!rounded-lg md:!border md:!border-green-200 md:!border-b-4 md:!border-b-green-500"
        >
            <div className="flex h-full min-h-0 flex-col bg-gradient-to-br from-green-50 via-background to-white dark:from-green-950/30 dark:via-background dark:to-background">
                <div className="flex min-h-0 flex-1 overflow-y-auto px-4 py-8 md:px-8 md:py-8">
                    <Stack
                        spacing={6}
                        className={cx(
                            'm-auto w-full items-center text-center',
                            step === 'layouts' ? 'max-w-6xl' : 'max-w-5xl',
                            step === 'tasks' && 'max-w-4xl',
                        )}
                    >
                        <div
                            className={styles.wizardStepPanel}
                            data-raised-bed-onboarding-step={step}
                            data-step-direction={stepDirection}
                            key={step}
                        >
                            {step === 'goal' ? (
                                <Stack spacing={2} className="items-center">
                                    <span className="inline-flex items-center gap-2 rounded-full bg-green-700 px-4 py-2 text-base font-semibold text-white shadow-sm md:text-lg">
                                        <Sprout className="size-5" />
                                        Prva gredica
                                    </span>
                                    <Typography
                                        level="h2"
                                        className="text-2xl"
                                    >
                                        Tvoja nova personalizirana gredica
                                    </Typography>
                                    <Typography level="body2" secondary>
                                        {targetRaisedBed.name
                                            ? `Za gredicu ${targetRaisedBed.name}`
                                            : 'Za tvoju prvu gredicu'}
                                    </Typography>
                                </Stack>
                            ) : null}

                            {step === 'goal' ? (
                                <Stack
                                    spacing={2}
                                    className="w-full items-center"
                                >
                                    <Typography
                                        className="text-lg md:text-xl"
                                        semiBold
                                    >
                                        Što želiš najčešće jesti?
                                    </Typography>
                                    <div className="grid w-full max-w-2xl gap-2">
                                        {raisedBedOnboardingGoals.map(
                                            (option) => (
                                                <button
                                                    className={cx(
                                                        'rounded-lg border bg-card p-3 text-left transition-colors hover:bg-green-50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2 dark:hover:bg-green-950/30',
                                                        goal === option.value &&
                                                            'border-green-500 bg-green-50/80 ring-1 ring-green-500 dark:bg-green-950/40',
                                                    )}
                                                    key={option.value}
                                                    onClick={() => {
                                                        track(
                                                            'game_raised_bed_onboarding_goal_selected',
                                                            {
                                                                ...onboardingAnalyticsProperties(
                                                                    'goal',
                                                                ),
                                                                previous_goal:
                                                                    goal,
                                                                goal: option.value,
                                                            },
                                                        );
                                                        setGoal(option.value);
                                                    }}
                                                    type="button"
                                                >
                                                    <Row
                                                        alignItems="start"
                                                        justifyContent="space-between"
                                                        spacing={2}
                                                    >
                                                        <Stack spacing={1}>
                                                            <Typography
                                                                semiBold
                                                            >
                                                                {option.label}
                                                            </Typography>
                                                            <Typography
                                                                level="body3"
                                                                secondary
                                                            >
                                                                {
                                                                    option.description
                                                                }
                                                            </Typography>
                                                        </Stack>
                                                        {goal ===
                                                        option.value ? (
                                                            <Check className="size-5 shrink-0 text-green-700" />
                                                        ) : null}
                                                    </Row>
                                                </button>
                                            ),
                                        )}
                                    </div>
                                </Stack>
                            ) : null}

                            {step === 'care' ? (
                                <Stack
                                    spacing={2}
                                    className="w-full items-center"
                                >
                                    <Typography
                                        className="text-lg md:text-xl"
                                        semiBold
                                    >
                                        Kakav ritam želiš?
                                    </Typography>
                                    <div className="grid w-full max-w-2xl gap-2">
                                        {raisedBedOnboardingCareOptions.map(
                                            (option) => (
                                                <button
                                                    className={cx(
                                                        'rounded-lg border bg-card p-3 text-left transition-colors hover:bg-green-50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2 dark:hover:bg-green-950/30',
                                                        care === option.value &&
                                                            'border-green-500 bg-green-50/80 ring-1 ring-green-500 dark:bg-green-950/40',
                                                    )}
                                                    key={option.value}
                                                    onClick={() => {
                                                        track(
                                                            'game_raised_bed_onboarding_care_selected',
                                                            {
                                                                ...onboardingAnalyticsProperties(
                                                                    'care',
                                                                ),
                                                                previous_care:
                                                                    care,
                                                                care: option.value,
                                                            },
                                                        );
                                                        setCare(option.value);
                                                    }}
                                                    type="button"
                                                >
                                                    <Stack spacing={1}>
                                                        <Row
                                                            justifyContent="space-between"
                                                            spacing={2}
                                                        >
                                                            <Typography
                                                                semiBold
                                                            >
                                                                {option.label}
                                                            </Typography>
                                                            {care ===
                                                            option.value ? (
                                                                <Check className="size-5 shrink-0 text-green-700" />
                                                            ) : null}
                                                        </Row>
                                                        <Typography
                                                            level="body3"
                                                            secondary
                                                        >
                                                            {option.description}
                                                        </Typography>
                                                    </Stack>
                                                </button>
                                            ),
                                        )}
                                    </div>
                                </Stack>
                            ) : null}

                            {step === 'layouts' ? (
                                <Stack
                                    spacing={6}
                                    className="w-full items-center"
                                >
                                    <Stack spacing={1} className="items-center">
                                        <Typography
                                            className="text-lg md:text-xl"
                                            semiBold
                                        >
                                            Odaberi raspored
                                        </Typography>
                                        <Typography level="body2" secondary>
                                            Svi prijedlozi ostavljaju šest
                                            praznih polja za tvoje kasnije
                                            ideje.
                                        </Typography>
                                    </Stack>
                                    {selectedLayout ? (
                                        <LayoutSuggestionCarousel
                                            direction={layoutCarouselDirection}
                                            layout={selectedLayout}
                                            layoutCount={layouts.length}
                                            onNext={() =>
                                                selectLayoutAtIndex(
                                                    selectedLayoutIndex + 1,
                                                    'next',
                                                )
                                            }
                                            onPrevious={() =>
                                                selectLayoutAtIndex(
                                                    selectedLayoutIndex - 1,
                                                    'previous',
                                                )
                                            }
                                        />
                                    ) : null}
                                </Stack>
                            ) : null}

                            {step === 'tasks' ? (
                                <Stack
                                    spacing={4}
                                    className="w-full items-center"
                                >
                                    <Stack spacing={1} className="items-center">
                                        <Typography
                                            className="text-lg md:text-xl"
                                            semiBold
                                        >
                                            Tvoji zadaci
                                        </Typography>
                                        <Typography level="body2" secondary>
                                            Kratki redoslijed za prvu narudžbu.
                                        </Typography>
                                    </Stack>
                                    <div className="grid w-full max-w-3xl gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
                                        <ol
                                            className="grid gap-2 text-left"
                                            data-raised-bed-onboarding-task-list="true"
                                        >
                                            {firstRaisedBedOnboardingTasks.map(
                                                (task, index) => {
                                                    const taskState =
                                                        index < 3
                                                            ? 'complete'
                                                            : index === 3
                                                              ? 'current'
                                                              : 'next';
                                                    const displayIndex =
                                                        index + 1;
                                                    return (
                                                        <li
                                                            aria-current={
                                                                taskState ===
                                                                'current'
                                                                    ? 'step'
                                                                    : undefined
                                                            }
                                                            className={cx(
                                                                'grid grid-cols-[2rem_minmax(0,1fr)] gap-3 rounded-lg border p-3 transition-colors',
                                                                taskState ===
                                                                    'current'
                                                                    ? 'border-green-500 bg-green-50/90 shadow-sm ring-1 ring-green-400/70 dark:border-green-700 dark:bg-green-950/40 dark:ring-green-800'
                                                                    : 'border-green-100 bg-white/85 dark:border-green-900/60 dark:bg-background/80',
                                                            )}
                                                            data-raised-bed-onboarding-task-id={
                                                                task.id
                                                            }
                                                            data-raised-bed-onboarding-task-state={
                                                                taskState
                                                            }
                                                            key={task.id}
                                                        >
                                                            <span
                                                                className={cx(
                                                                    'grid size-8 place-items-center rounded-md text-sm font-semibold',
                                                                    taskState ===
                                                                        'complete'
                                                                        ? 'bg-green-600 text-white dark:bg-green-700'
                                                                        : taskState ===
                                                                            'current'
                                                                          ? 'bg-green-100 text-green-950 ring-2 ring-green-500 dark:bg-green-900 dark:text-green-50'
                                                                          : 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200',
                                                                )}
                                                                data-raised-bed-onboarding-task-badge="true"
                                                            >
                                                                {taskState ===
                                                                'complete' ? (
                                                                    <Check className="size-4" />
                                                                ) : (
                                                                    displayIndex.toString()
                                                                )}
                                                            </span>
                                                            <Stack
                                                                spacing={0.5}
                                                            >
                                                                <Typography
                                                                    level="body2"
                                                                    semiBold
                                                                >
                                                                    {task.title}
                                                                </Typography>
                                                                <Typography
                                                                    level="body3"
                                                                    secondary
                                                                >
                                                                    {
                                                                        task.shortDescription
                                                                    }
                                                                </Typography>
                                                            </Stack>
                                                        </li>
                                                    );
                                                },
                                            )}
                                        </ol>
                                        <aside
                                            className="text-left"
                                            data-raised-bed-onboarding-picked-layout="true"
                                        >
                                            <Stack spacing={3}>
                                                <Row spacing={2}>
                                                    <Info className="size-4 text-green-700" />
                                                    <Typography semiBold>
                                                        Spremno za košaru
                                                    </Typography>
                                                </Row>
                                                {selectedLayout ? (
                                                    <>
                                                        <LayoutGrid
                                                            layout={
                                                                selectedLayout
                                                            }
                                                            selected
                                                        />
                                                        <Stack spacing={1}>
                                                            <Typography
                                                                semiBold
                                                            >
                                                                {
                                                                    selectedLayout.title
                                                                }
                                                            </Typography>
                                                            <Typography
                                                                level="body3"
                                                                secondary
                                                            >
                                                                {
                                                                    selectedLayout.subtitle
                                                                }
                                                            </Typography>
                                                        </Stack>
                                                    </>
                                                ) : null}
                                                {applyError ? (
                                                    <Alert color="danger">
                                                        {applyError}
                                                    </Alert>
                                                ) : null}
                                            </Stack>
                                        </aside>
                                    </div>
                                </Stack>
                            ) : null}
                        </div>

                        <Stack spacing={5} className="items-center">
                            {onboardingActions}
                            <Stack spacing={4} className="items-center">
                                <StepProgress step={step} />
                                <Button
                                    className="w-fit px-0 text-sm"
                                    color="success"
                                    href={KnownPages.GrediceFirstRaisedBedGuide}
                                    onClick={() =>
                                        track(
                                            'game_raised_bed_onboarding_guide_opened',
                                            {
                                                ...onboardingAnalyticsProperties(),
                                            },
                                        )
                                    }
                                    rel="noreferrer"
                                    size="sm"
                                    target="_blank"
                                    variant="link"
                                    endDecorator={
                                        <ExternalLink className="size-3.5" />
                                    }
                                >
                                    Detaljan vodič
                                </Button>
                            </Stack>
                        </Stack>
                    </Stack>
                </div>
            </div>
        </GameModal>
    );

    if (showTrigger) {
        return (
            <HudCard
                open
                position="floating"
                className="static p-0.5"
                data-raised-bed-onboarding-hud="true"
                glow
            >
                {modal}
            </HudCard>
        );
    }

    return modal;
}
