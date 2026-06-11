'use client';

import { isRaisedBedAbandoned } from '@gredice/js/raisedBeds';
import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { Chip } from '@gredice/ui/Chip';
import { Check, Close, Leaf, ShoppingCart, Sprout } from '@gredice/ui/icons';
import { Modal } from '@gredice/ui/Modal';
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
    onResolved?: () => void;
};

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
    layout,
    selected,
}: {
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
                'grid grid-cols-6 gap-1 rounded-lg border bg-muted/30 p-2',
                selected && 'border-primary bg-primary/5',
            )}
        >
            {Array.from({ length: 18 }, (_, visualIndex) => {
                const row = Math.floor(visualIndex / 6);
                const col = visualIndex % 6;
                const positionIndex = col * 3 + row;
                const placement = placementsByPosition.get(positionIndex);

                return (
                    <div
                        className={cx(
                            'flex aspect-square min-w-0 items-center justify-center rounded-md border text-[10px] font-semibold leading-none',
                            placement
                                ? 'border-green-500/40 bg-green-100 text-green-950 dark:border-green-700/60 dark:bg-green-950/50 dark:text-green-100'
                                : 'border-dashed border-border bg-background text-muted-foreground',
                        )}
                        key={positionIndex}
                        title={
                            placement
                                ? `${placement.cropDetails.sortName} · polje ${positionLabel(positionIndex)}`
                                : 'Prazno za kasnije'
                        }
                    >
                        {placement
                            ? placement.cropDetails.label.slice(0, 2)
                            : ''}
                    </div>
                );
            })}
        </div>
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
                'grid min-w-0 gap-3 rounded-lg border bg-card p-3 text-left shadow-sm transition-colors hover:bg-muted/60 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
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
            <LayoutGrid layout={layout} selected={selected} />
            <div className="flex flex-wrap gap-1.5">
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
    enabled,
    onResolved,
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
    const [step, setStep] = useState<'preferences' | 'layouts'>('preferences');
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
    const canOfferOnboarding = Boolean(
        enabled &&
            dataReady &&
            targetRaisedBed &&
            targetBlock &&
            layouts.length > 0 &&
            !dismissed,
    );

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

        if (!canOfferOnboarding) {
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
        canOfferOnboarding,
        currentGarden?.id,
        dataReady,
        enabled,
        reportResolved,
        targetRaisedBed?.id,
        track,
    ]);

    useEffect(() => {
        if (
            selectedLayoutId &&
            layouts.some((layout) => layout.id === selectedLayoutId)
        ) {
            return;
        }

        setSelectedLayoutId(layouts[0]?.id ?? null);
    }, [layouts, selectedLayoutId]);

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
                if (!nextOpen) {
                    dismiss('closed');
                }
            }}
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
                    >
                        <Stack spacing={1} className="min-w-0">
                            <Row spacing={2} className="flex-wrap">
                                <Chip
                                    color="success"
                                    size="sm"
                                    startDecorator={
                                        <Sprout className="size-3.5" />
                                    }
                                    variant="soft"
                                >
                                    Prva gredica
                                </Chip>
                                <Chip size="sm" variant="outlined">
                                    12 polja + 6 praznih
                                </Chip>
                            </Row>
                            <Typography
                                level="h2"
                                className="text-2xl md:text-3xl"
                            >
                                Brzi plan sadnje
                            </Typography>
                            <Typography level="body2" secondary>
                                {targetRaisedBed.name
                                    ? `Za gredicu ${targetRaisedBed.name}`
                                    : 'Za tvoju prvu gredicu'}
                            </Typography>
                        </Stack>
                        <div className="hidden min-w-44 md:block">
                            {selectedLayout ? (
                                <LayoutGrid layout={selectedLayout} selected />
                            ) : null}
                        </div>
                    </Row>
                </header>
                <div className="min-h-0 overflow-y-auto px-4 py-4 md:px-6 md:py-5">
                    {step === 'preferences' ? (
                        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]">
                            <Stack spacing={5}>
                                <Stack spacing={2}>
                                    <Typography className="text-lg" semiBold>
                                        Što želiš najčešće jesti?
                                    </Typography>
                                    <div className="grid gap-2 sm:grid-cols-2">
                                        {raisedBedOnboardingGoals.map(
                                            (option) => (
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
                                                            <Check className="size-5 shrink-0 text-primary" />
                                                        ) : null}
                                                    </Row>
                                                </button>
                                            ),
                                        )}
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
                                                            <Typography
                                                                semiBold
                                                            >
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
                            <aside className="rounded-lg border bg-card p-4">
                                <Stack spacing={3}>
                                    <Row spacing={2}>
                                        <Leaf className="size-5 text-primary" />
                                        <Typography semiBold>
                                            Prvi prijedlog
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
                    ) : (
                        <Stack spacing={4}>
                            <Stack spacing={1}>
                                <Typography className="text-lg" semiBold>
                                    Odaberi raspored
                                </Typography>
                                <Typography level="body2" secondary>
                                    Svi prijedlozi ostavljaju šest praznih polja
                                    za tvoje kasnije ideje.
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
                            {applyError ? (
                                <Alert color="danger">{applyError}</Alert>
                            ) : null}
                        </Stack>
                    )}
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
                                    onClick={() => setStep('preferences')}
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
                                Prikaži rasporede
                            </Button>
                        ) : (
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
                        )}
                    </Row>
                </footer>
            </div>
        </Modal>
    );
}
