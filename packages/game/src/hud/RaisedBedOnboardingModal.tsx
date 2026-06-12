'use client';

import { isRaisedBedAbandoned } from '@gredice/js/raisedBeds';
import { firstRaisedBedTutorialTasks } from '@gredice/js/raisedBedTutorial';
import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { Chip } from '@gredice/ui/Chip';
import {
    Check,
    Close,
    ExternalLink,
    Info,
    Leaf,
    ShoppingCart,
    Sprout,
} from '@gredice/ui/icons';
import { Modal } from '@gredice/ui/Modal';
import { PlantOrSortImage } from '@gredice/ui/plants';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useGameState } from '../useGameState';
import { useSetRaisedBedCloseupParam } from '../useRaisedBedCloseup';
import { isRaisedBedFieldOccupied } from '../utils/raisedBedFields';
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

type RaisedBedOnboardingModalProps = {
    enabled: boolean;
    autoOpen?: boolean;
    onResolved?: () => void;
    showTrigger?: boolean;
};

type RaisedBedOnboardingStep = 'preferences' | 'layouts' | 'tasks';

const onboardingSteps: {
    id: RaisedBedOnboardingStep;
    label: string;
}[] = [
    { id: 'preferences', label: 'Odabir' },
    { id: 'layouts', label: 'Raspored' },
    { id: 'tasks', label: 'Koraci' },
];

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
                'grid grid-cols-3 gap-1 rounded-xl border bg-muted/30 p-2',
                compact ? 'w-28' : 'mx-auto w-full max-w-64 gap-1.5 p-2.5',
                selected && 'border-primary bg-primary/5',
            )}
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
                                ? 'border-green-500/50 bg-green-100 text-green-950 dark:border-green-700/60 dark:bg-green-950/50 dark:text-green-100'
                                : 'border-dashed border-border bg-background/80 text-muted-foreground',
                        )}
                        key={positionIndex}
                        title={
                            placement
                                ? `${placement.cropDetails.sortName} · polje ${positionLabel(positionIndex)}`
                                : 'Prazno za kasnije'
                        }
                    >
                        {placement ? (
                            <>
                                <PlantOrSortImage
                                    alt={placement.cropDetails.sortName}
                                    className="object-cover"
                                    fill
                                    plantSort={placement.cropDetails.sort}
                                    sizes={compact ? '44px' : '76px'}
                                />
                                <span className="absolute bottom-0.5 left-0.5 rounded bg-black/55 px-1 py-0.5 text-[9px] font-semibold leading-none text-white shadow-sm">
                                    {placement.cropDetails.label.slice(0, 2)}
                                </span>
                            </>
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
        <Row spacing={1.5} className="flex-wrap">
            {onboardingSteps.map((item, index) => {
                const isCurrent = item.id === step;
                const isDone = index < currentIndex;

                return (
                    <span
                        className={cx(
                            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold',
                            isCurrent &&
                                'border-primary bg-primary text-primary-foreground',
                            isDone &&
                                'border-primary/50 bg-primary/10 text-primary',
                            !isCurrent &&
                                !isDone &&
                                'border-border bg-muted/40 text-muted-foreground',
                        )}
                        key={item.id}
                    >
                        {isDone ? <Check className="size-3.5" /> : null}
                        {item.label}
                    </span>
                );
            })}
        </Row>
    );
}

function LayoutCard({
    layout,
    onSelect,
    selected,
}: {
    layout: RaisedBedOnboardingLayout;
    onSelect: () => void;
    selected: boolean;
}) {
    return (
        <button
            className={cx(
                'grid min-w-0 gap-3 rounded-lg border bg-card p-3 text-left shadow-sm transition-colors hover:bg-muted/60 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:grid-cols-[minmax(0,1fr)_7rem]',
                selected && 'border-primary ring-1 ring-primary',
            )}
            onClick={onSelect}
            type="button"
        >
            <Row alignItems="start" justifyContent="space-between" spacing={3}>
                <Stack spacing={1} className="min-w-0">
                    <Typography className="text-base" semiBold>
                        {layout.title}
                    </Typography>
                    <Typography
                        className="line-clamp-2"
                        level="body3"
                        secondary
                    >
                        {layout.subtitle}
                    </Typography>
                </Stack>
                {selected ? (
                    <span
                        className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"
                        title="Odabrano"
                    >
                        <Check className="size-4" />
                    </span>
                ) : null}
            </Row>
            <LayoutGrid compact layout={layout} selected={selected} />
            <div className="flex flex-wrap gap-1.5 md:col-span-2">
                {cropCounts(layout).map((item) => (
                    <Chip key={item.label} size="sm" variant="soft">
                        {item.label} x{item.count.toString()}
                    </Chip>
                ))}
            </div>
        </button>
    );
}

export function RaisedBedOnboardingModal({
    autoOpen,
    enabled,
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
    const [step, setStep] = useState<RaisedBedOnboardingStep>('preferences');
    const [selectedLayoutId, setSelectedLayoutId] = useState<string | null>(
        null,
    );
    const [open, setOpen] = useState(false);
    const [dismissedSnapshot, setDismissedSnapshot] = useState<{
        dismissed: boolean;
        key: string | null;
    }>({ dismissed: true, key: null });
    const [applyError, setApplyError] = useState<string | null>(null);
    const [isApplying, setIsApplying] = useState(false);
    const resolvedRef = useRef(false);
    const openedRef = useRef(false);
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
        (source: 'applied' | 'closed' | 'skipped') => {
            writeDismissed(dismissedKey);
            setDismissedSnapshot({ dismissed: true, key: dismissedKey });
            setOpen(false);
            focusRaisedBed();
            track('game_raised_bed_onboarding_dismissed', {
                garden_id: currentGarden?.id,
                raised_bed_id: targetRaisedBed?.id,
                source,
            });
            reportResolved();
        },
        [
            currentGarden?.id,
            dismissedKey,
            focusRaisedBed,
            reportResolved,
            targetRaisedBed?.id,
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
        setStep('preferences');
        setApplyError(null);
        setSelectedLayoutId(null);
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
                garden_id: currentGarden?.id,
                raised_bed_id: targetRaisedBed?.id,
            });
        }
    }, [
        canAutoOpenOnboarding,
        currentGarden?.id,
        dataReady,
        enabled,
        reportResolved,
        shouldAutoOpen,
        targetRaisedBed?.id,
        track,
    ]);

    useEffect(() => {
        setSelectedLayoutId(layouts[0]?.id ?? null);
    }, [layouts]);

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
                garden_id: currentGarden.id,
                layout_id: selectedLayout.id,
                raised_bed_id: targetRaisedBed.id,
                planted_fields: selectedLayout.placements.length,
            });
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

    return (
        <Modal
            title="Brzi plan gredice"
            open={open}
            onOpenChange={(nextOpen) => {
                if (nextOpen) {
                    setOpen(true);
                    track('game_raised_bed_onboarding_opened', {
                        garden_id: currentGarden?.id,
                        raised_bed_id: targetRaisedBed?.id,
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
                        className="rounded-full gap-2"
                        size="sm"
                        startDecorator={<Sprout className="size-4" />}
                        title="Otvori vodič za prvu gredicu"
                        variant="soft"
                    >
                        Prva gredica
                    </Button>
                ) : undefined
            }
            disableMobile
            overlayClassName="bg-black/45 backdrop-blur-md"
            className="!inset-0 !h-dvh !max-h-dvh !w-screen !max-w-none !translate-x-0 !translate-y-0 !overflow-hidden !rounded-none !border-0 !p-0 md:!inset-auto md:!left-1/2 md:!top-1/2 md:!h-[calc(100dvh-2rem)] md:!w-[calc(100vw-2rem)] md:!max-w-6xl md:!-translate-x-1/2 md:!-translate-y-1/2 md:!rounded-lg md:!border md:border-tertiary md:border-b-4"
        >
            <div className="grid h-full min-h-0 grid-rows-[auto_1fr_auto] bg-background">
                <header className="border-b px-4 py-3 pr-14 md:px-6 md:py-4">
                    <Row
                        alignItems="start"
                        justifyContent="space-between"
                        spacing={4}
                        className="flex-wrap"
                    >
                        <Stack spacing={1} className="min-w-0">
                            <Row spacing={2} className="flex-wrap">
                                <span className="inline-flex items-center gap-2 rounded-full bg-primary px-3 py-1.5 text-base font-semibold text-primary-foreground shadow-sm md:text-lg">
                                    <Sprout className="size-5" />
                                    Prva gredica
                                </span>
                            </Row>
                            <Typography
                                level="h2"
                                className="text-xl md:text-2xl"
                            >
                                Brzi plan sadnje
                            </Typography>
                            <Typography level="body2" secondary>
                                {targetRaisedBed.name
                                    ? `Za gredicu ${targetRaisedBed.name}`
                                    : 'Za tvoju prvu gredicu'}
                            </Typography>
                            <Button
                                className="w-fit px-0"
                                href={KnownPages.GrediceFirstRaisedBedGuide}
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
                        <StepProgress step={step} />
                    </Row>
                </header>
                <div className="min-h-0 overflow-y-auto px-4 py-4 md:px-6 md:py-5">
                    {step === 'preferences' ? (
                        <Stack spacing={5} className="max-w-5xl">
                            <Stack spacing={2}>
                                <Typography className="text-lg" semiBold>
                                    Što želiš najčešće jesti?
                                </Typography>
                                <div className="grid gap-2 sm:grid-cols-2">
                                    {raisedBedOnboardingGoals.map((option) => (
                                        <button
                                            className={cx(
                                                'rounded-lg border bg-card p-3 text-left transition-colors hover:bg-muted/60 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                                                goal === option.value &&
                                                    'border-primary bg-primary/5 ring-1 ring-primary',
                                            )}
                                            key={option.value}
                                            onClick={() =>
                                                setGoal(option.value)
                                            }
                                            type="button"
                                        >
                                            <Row
                                                alignItems="start"
                                                justifyContent="space-between"
                                                spacing={2}
                                            >
                                                <Stack spacing={1}>
                                                    <Typography semiBold>
                                                        {option.label}
                                                    </Typography>
                                                    <Typography
                                                        level="body3"
                                                        secondary
                                                    >
                                                        {option.description}
                                                    </Typography>
                                                </Stack>
                                                {goal === option.value ? (
                                                    <Check className="size-5 shrink-0 text-primary" />
                                                ) : null}
                                            </Row>
                                        </button>
                                    ))}
                                </div>
                            </Stack>
                            <Stack spacing={2}>
                                <Typography className="text-lg" semiBold>
                                    Kakav ritam želiš?
                                </Typography>
                                <div className="grid gap-2 md:grid-cols-3">
                                    {raisedBedOnboardingCareOptions.map(
                                        (option) => (
                                            <button
                                                className={cx(
                                                    'rounded-lg border bg-card p-3 text-left transition-colors hover:bg-muted/60 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                                                    care === option.value &&
                                                        'border-primary bg-primary/5 ring-1 ring-primary',
                                                )}
                                                key={option.value}
                                                onClick={() =>
                                                    setCare(option.value)
                                                }
                                                type="button"
                                            >
                                                <Stack spacing={1}>
                                                    <Row
                                                        justifyContent="space-between"
                                                        spacing={2}
                                                    >
                                                        <Typography semiBold>
                                                            {option.label}
                                                        </Typography>
                                                        {care ===
                                                        option.value ? (
                                                            <Check className="size-5 shrink-0 text-primary" />
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
                        </Stack>
                    ) : null}
                    {step === 'layouts' ? (
                        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(15rem,18rem)]">
                            <Stack spacing={4}>
                                <Stack spacing={1}>
                                    <Typography className="text-lg" semiBold>
                                        Odaberi raspored
                                    </Typography>
                                    <Typography level="body2" secondary>
                                        Svi prijedlozi ostavljaju šest praznih
                                        polja za tvoje kasnije ideje.
                                    </Typography>
                                </Stack>
                                <div className="grid gap-3 lg:grid-cols-2">
                                    {layouts.slice(0, 4).map((layout) => (
                                        <LayoutCard
                                            key={layout.id}
                                            layout={layout}
                                            onSelect={() =>
                                                setSelectedLayoutId(layout.id)
                                            }
                                            selected={
                                                layout.id === selectedLayout?.id
                                            }
                                        />
                                    ))}
                                </div>
                            </Stack>
                            <aside className="rounded-lg border bg-card p-4">
                                <Stack spacing={3}>
                                    <Row spacing={2}>
                                        <Leaf className="size-5 text-primary" />
                                        <Typography semiBold>
                                            Odabrani prijedlog
                                        </Typography>
                                    </Row>
                                    {selectedLayout ? (
                                        <>
                                            <LayoutGrid
                                                layout={selectedLayout}
                                                selected
                                            />
                                            <Stack spacing={1}>
                                                <Typography semiBold>
                                                    {selectedLayout.title}
                                                </Typography>
                                                <Typography
                                                    level="body3"
                                                    secondary
                                                >
                                                    {selectedLayout.subtitle}
                                                </Typography>
                                            </Stack>
                                            <div className="flex flex-wrap gap-1.5">
                                                {selectedLayout.highlights.map(
                                                    (highlight) => (
                                                        <Chip
                                                            key={highlight}
                                                            size="sm"
                                                            variant="soft"
                                                        >
                                                            {highlight}
                                                        </Chip>
                                                    ),
                                                )}
                                            </div>
                                        </>
                                    ) : null}
                                </Stack>
                            </aside>
                        </div>
                    ) : null}
                    {step === 'tasks' ? (
                        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(15rem,18rem)]">
                            <Stack spacing={4}>
                                <Stack spacing={1}>
                                    <Typography className="text-lg" semiBold>
                                        Tvoji zadaci
                                    </Typography>
                                    <Typography level="body2" secondary>
                                        Kratki redoslijed za prvu narudžbu.
                                    </Typography>
                                </Stack>
                                <ol className="grid gap-2">
                                    {firstRaisedBedTutorialTasks.map(
                                        (task, index) => (
                                            <li
                                                className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3 rounded-lg border bg-card p-3"
                                                key={task.id}
                                            >
                                                <span className="grid size-8 place-items-center rounded-md bg-primary/10 text-sm font-semibold text-primary">
                                                    {(index + 1).toString()}
                                                </span>
                                                <Stack spacing={0.5}>
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
                                                        {task.shortDescription}
                                                    </Typography>
                                                </Stack>
                                            </li>
                                        ),
                                    )}
                                </ol>
                            </Stack>
                            <aside className="rounded-lg border bg-card p-4">
                                <Stack spacing={3}>
                                    <Row spacing={2}>
                                        <Info className="size-4 text-primary" />
                                        <Typography semiBold>
                                            Spremno za košaru
                                        </Typography>
                                    </Row>
                                    {selectedLayout ? (
                                        <>
                                            <LayoutGrid
                                                layout={selectedLayout}
                                                selected
                                            />
                                            <Stack spacing={1}>
                                                <Typography semiBold>
                                                    {selectedLayout.title}
                                                </Typography>
                                                <Typography
                                                    level="body3"
                                                    secondary
                                                >
                                                    {selectedLayout.subtitle}
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
                    ) : null}
                </div>
                <footer className="border-t bg-background/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur md:px-6">
                    <Row
                        className="flex-wrap gap-2 max-[420px]:flex-col-reverse max-[420px]:items-stretch"
                        justifyContent="space-between"
                        spacing={2}
                    >
                        <Row
                            className="flex-wrap max-[420px]:flex-col max-[420px]:items-stretch"
                            spacing={2}
                        >
                            {step === 'preferences' ? (
                                <Button
                                    disabled={isApplying}
                                    onClick={() => dismiss('skipped')}
                                    variant="plain"
                                >
                                    Preskoči
                                </Button>
                            ) : (
                                <Button
                                    disabled={isApplying}
                                    onClick={() =>
                                        setStep(
                                            step === 'tasks'
                                                ? 'layouts'
                                                : 'preferences',
                                        )
                                    }
                                    variant="plain"
                                >
                                    Natrag
                                </Button>
                            )}
                            <Button
                                disabled={isApplying}
                                onClick={() => dismiss('closed')}
                                startDecorator={<Close className="size-4" />}
                                variant="outlined"
                            >
                                Zatvori
                            </Button>
                        </Row>
                        {step === 'preferences' ? (
                            <Button
                                onClick={() => setStep('layouts')}
                                startDecorator={<Leaf className="size-4" />}
                            >
                                Prikaži prijedloge
                            </Button>
                        ) : null}
                        {step === 'layouts' ? (
                            <Button
                                disabled={!selectedLayout}
                                onClick={() => setStep('tasks')}
                                startDecorator={<Info className="size-4" />}
                            >
                                Dalje
                            </Button>
                        ) : null}
                        {step === 'tasks' ? (
                            <Button
                                disabled={!selectedLayout}
                                loading={isApplying}
                                onClick={applyLayout}
                                startDecorator={
                                    <ShoppingCart className="size-4" />
                                }
                            >
                                Dodaj plan u košaru
                            </Button>
                        ) : null}
                    </Row>
                </footer>
            </div>
        </Modal>
    );
}
