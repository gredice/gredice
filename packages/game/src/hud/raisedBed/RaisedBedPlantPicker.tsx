import type { PlantData, PlantSortData } from '@gredice/client';
import { BackpackIcon } from '@gredice/ui/BackpackIcon';
import { Button } from '@gredice/ui/Button';
import { IconButton } from '@gredice/ui/IconButton';
import { Input } from '@gredice/ui/Input';
import { Close, Left, Search, ShoppingCart } from '@gredice/ui/icons';
import { Modal } from '@gredice/ui/Modal';
import { PlantingSeedIcon } from '@gredice/ui/PlantingSeedIcon';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import {
    type ChangeEvent,
    type ReactElement,
    useId,
    useLayoutEffect,
    useRef,
    useState,
} from 'react';
import { useGameAnalytics } from '../../analytics/GameAnalyticsContext';
import { SegmentedProgress } from '../../controls/components/SegmentedProgress';
import { useGardens } from '../../hooks/useGardens';
import { useInventory } from '../../hooks/useInventory';
import { useSandboxPlant } from '../../hooks/useSandboxPlant';
import { useSetShoppingCartItem } from '../../hooks/useSetShoppingCartItem';
import {
    type ShoppingCartItemData,
    useShoppingCart,
} from '../../hooks/useShoppingCart';
import {
    scheduleHideShoppingCartTransientHub,
    showShoppingCartTransientHub,
} from '../../hooks/useShoppingCartTransientHub';
import { PlantsList } from './PlantsList';
import { PlantsSortList } from './PlantsSortList';

// Sandbox ("play") gardens let you pick how grown the plant should look. Each
// preset backdates the sow date so the existing generation rendering draws a
// plant at the chosen maturity.
const SANDBOX_AGE_PRESETS = [
    { label: 'Mlada', ageDays: 14, status: 'sprouted' },
    { label: 'Srednja', ageDays: 40, status: 'sprouted' },
    { label: 'Zrela', ageDays: 80, status: 'ready' },
] as const;

// Helper to format date as YYYY-MM-DD in local time
// TODO: Move to shared utilities
export function formatLocalDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

type PlantPickerProps = {
    positionIndex: number;
    gardenId: number;
    raisedBedId: number;
    trigger: ReactElement;
    inShoppingCart?: boolean;
    selectedPlantId?: number | null;
    selectedSortId?: number | null;
    selectedPlantOptions?: { scheduledDate: Date | null | undefined } | null;
};

export function PlantPicker({
    gardenId,
    raisedBedId,
    positionIndex,
    trigger,
    inShoppingCart,
    selectedPlantId: preselectedPlantId,
    selectedSortId: preselectedSortId,
    selectedPlantOptions: preselectedPlantOptions,
}: PlantPickerProps) {
    const [open, setOpen] = useState(false);
    const { track } = useGameAnalytics();
    const steps = [
        {
            label: 'Odabir biljke',
            subHeader: 'Odaberi biljku koju želiš posaditi',
        },
        {
            label: 'Odabir sorte',
            subHeader: 'Odaberi sortu biljke koju želiš posaditi',
        },
    ];
    const { data: cart } = useShoppingCart();
    const setCartItem = useSetShoppingCartItem();
    const { data: inventory } = useInventory();
    // Derive sandbox from the gardens list by id (the picker already receives
    // gardenId) so it stays decoupled from the game-state context.
    const { data: gardens } = useGardens();
    const isSandbox = Boolean(
        gardens?.find((garden) => garden.id === gardenId)?.isSandbox,
    );
    const sandboxPlant = useSandboxPlant();
    const [sandboxAgeIndex, setSandboxAgeIndex] = useState(
        SANDBOX_AGE_PRESETS.length - 1,
    );
    const [selectedPlantId, setSelectedPlantId] = useState<number | null>(
        preselectedPlantId ?? null,
    );
    const [selectedSortId, setSelectedSortId] = useState<number | null>(
        preselectedSortId ?? null,
    );
    const [plantOptions, setPlantOptions] = useState<{
        scheduledDate: Date | null | undefined;
    } | null>(preselectedPlantOptions ?? null);
    const [flyToShoppingCart, setFlyToShoppingCart] = useState(false);
    const [useInventoryItem, setUseInventoryItem] = useState(false);
    const [search, setSearch] = useState('');
    const searchInputId = useId();
    const shouldRestoreSearchFocusRef = useRef(false);

    let currentStep = 0;
    if (selectedPlantId) {
        currentStep = 1;
    }

    useLayoutEffect(() => {
        if (
            currentStep !== 0 ||
            !shouldRestoreSearchFocusRef.current ||
            typeof document === 'undefined'
        ) {
            return;
        }

        const input = document.getElementById(searchInputId);
        if (!(input instanceof HTMLInputElement)) {
            return;
        }

        if (document.activeElement !== input) {
            input.focus();
            input.setSelectionRange(input.value.length, input.value.length);
        }
        shouldRestoreSearchFocusRef.current = false;
    });

    function resetSearch() {
        shouldRestoreSearchFocusRef.current = false;
        setSearch('');
    }

    function handleSearchChange(event: ChangeEvent<HTMLInputElement>) {
        shouldRestoreSearchFocusRef.current = true;
        setSearch(event.target.value);
    }

    function handlePlantSelect(plant: PlantData) {
        setSelectedPlantId(plant.id);
        setSelectedSortId(null);
        resetSearch();
    }

    function handleSortSelect(sort: PlantSortData) {
        setSelectedSortId(sort.id);
        resetSearch();
    }

    async function removeFromCart(existingItem?: ShoppingCartItemData) {
        // Remove existing item if it exists in cart already
        const itemToRemove =
            existingItem ??
            cart?.items.find(
                (item) =>
                    item.entityTypeName === 'plantSort' &&
                    item.gardenId === gardenId &&
                    item.raisedBedId === raisedBedId &&
                    item.positionIndex === positionIndex,
            );
        if (itemToRemove) {
            await setCartItem.mutateAsync({
                ...itemToRemove,
                gardenId: itemToRemove.gardenId ?? undefined,
                raisedBedId: itemToRemove.raisedBedId ?? undefined,
                positionIndex: itemToRemove.positionIndex ?? undefined,
                amount: 0,
            });
        }
    }

    async function handleRemove() {
        track('game_planting_removed', {
            garden_id: gardenId,
            in_shopping_cart: inShoppingCart,
            position_index: positionIndex,
            raised_bed_id: raisedBedId,
            sort_id: selectedSortId,
        });
        setOpen(false);
        setSelectedPlantId(null);
        setSelectedSortId(null);
        setPlantOptions(null);
        setUseInventoryItem(false);
        resetSearch();
        await removeFromCart();
    }

    async function handleConfirm() {
        if (!selectedSortId) {
            return;
        }

        // Sandbox gardens plant directly at the chosen age — no cart/economy.
        if (isSandbox) {
            const preset = SANDBOX_AGE_PRESETS[sandboxAgeIndex];
            track('game_planting_confirmed', {
                garden_id: gardenId,
                in_shopping_cart: false,
                is_sandbox: true,
                plant_id: selectedPlantId,
                position_index: positionIndex,
                raised_bed_id: raisedBedId,
                sort_id: selectedSortId,
                sandbox_age_days: preset.ageDays,
            });
            try {
                await sandboxPlant.mutateAsync({
                    gardenId,
                    raisedBedId,
                    positionIndex,
                    plantSortId: selectedSortId,
                    ageDays: preset.ageDays,
                    status: preset.status,
                });
            } finally {
                setOpen(false);
                setSelectedPlantId(null);
                setSelectedSortId(null);
                resetSearch();
            }
            return;
        }

        const existingItem = cart?.items.find(
            (item) =>
                item.entityTypeName === 'plantSort' &&
                item.gardenId === gardenId &&
                item.raisedBedId === raisedBedId &&
                item.positionIndex === positionIndex,
        );

        if (
            existingItem &&
            existingItem.entityId !== selectedSortId.toString()
        ) {
            await removeFromCart(existingItem);
        }

        // Add new item to cart
        track('game_planting_confirmed', {
            garden_id: gardenId,
            in_shopping_cart: inShoppingCart,
            plant_id: selectedPlantId,
            position_index: positionIndex,
            raised_bed_id: raisedBedId,
            scheduled_date: plantOptions?.scheduledDate?.toISOString(),
            sort_id: selectedSortId,
            use_inventory: useInventoryItem,
        });
        showShoppingCartTransientHub();
        setFlyToShoppingCart(true);
        try {
            await setCartItem.mutateAsync({
                entityTypeName: 'plantSort',
                entityId: selectedSortId?.toString(),
                amount: 1,
                gardenId,
                raisedBedId,
                positionIndex,
                additionalData: JSON.stringify({
                    scheduledDate: plantOptions?.scheduledDate?.toISOString(),
                }),
                currency: useInventoryItem ? 'inventory' : 'eur',
            });
            await new Promise((resolve) => setTimeout(resolve, 800)); // Wait for animation to finish
        } finally {
            scheduleHideShoppingCartTransientHub();
            setOpen(false);
            setFlyToShoppingCart(false);
        }
    }

    function handleOpenChange(open: boolean) {
        if (open) {
            track('game_plant_picker_opened', {
                garden_id: gardenId,
                in_shopping_cart: inShoppingCart,
                position_index: positionIndex,
                raised_bed_id: raisedBedId,
            });
        }
        setOpen(open);
        setSelectedPlantId(preselectedPlantId ?? null);
        setSelectedSortId(preselectedSortId ?? null);
        setPlantOptions(preselectedPlantOptions ?? null);
        resetSearch();
        const existingItem = cart?.items.find(
            (item) =>
                item.entityTypeName === 'plantSort' &&
                item.gardenId === gardenId &&
                item.raisedBedId === raisedBedId &&
                item.positionIndex === positionIndex,
        );
        setUseInventoryItem(existingItem?.currency === 'inventory');
    }

    // Plant options
    // Use local time for tomorrow and 3 months from now
    const today = new Date();
    const tomorrow = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() + 1,
    );
    const threeMonthsFromTomorrow = new Date(
        tomorrow.getFullYear(),
        tomorrow.getMonth() + 3,
        tomorrow.getDate(),
    );
    const plantDate = formatLocalDate(plantOptions?.scheduledDate ?? tomorrow);
    function handlePlantDateChange(date: string) {
        const parsedDate = date ? new Date(date) : null;
        setPlantOptions({ scheduledDate: parsedDate });
    }

    const min = formatLocalDate(tomorrow);
    const max = formatLocalDate(threeMonthsFromTomorrow);

    const availableFromInventory = inventory?.items?.find(
        (item) =>
            item.entityTypeName === 'plantSort' &&
            item.entityId === selectedSortId?.toString(),
    )?.amount;

    return (
        <Modal
            trigger={trigger}
            open={open}
            onOpenChange={handleOpenChange}
            title={'Sijanje biljke'}
            modal={false}
            className="md:border-tertiary md:border-b-4 md:max-w-2xl"
        >
            <Stack spacing={4}>
                <SegmentedProgress
                    className="pb-4 pr-8 w-full md:w-80 self-center"
                    segments={steps.map((step, stepIndex) => ({
                        value:
                            currentStep > stepIndex
                                ? 100
                                : currentStep < stepIndex
                                  ? 0
                                  : 99,
                        highlighted: stepIndex === currentStep,
                        label: step.label,
                        onClick:
                            selectedPlantId && stepIndex === 0
                                ? () => {
                                      setSelectedPlantId(null);
                                      setSelectedSortId(null);
                                      resetSearch();
                                  }
                                : undefined,
                    }))}
                />
                <Stack>
                    <Typography level="h3" className="text-xl">
                        {steps[currentStep].label}
                    </Typography>
                    <Typography level="body2">
                        {steps[currentStep].subHeader}
                    </Typography>
                </Stack>
                {currentStep < 1 && (
                    <Input
                        id={searchInputId}
                        name="plantSearch"
                        value={search}
                        onChange={handleSearchChange}
                        placeholder="Pretraži..."
                        startDecorator={
                            <Search className="size-5 shrink-0 ml-3" />
                        }
                        endDecorator={
                            <IconButton
                                className={cx(
                                    'hover:bg-neutral-300 mr-1 rounded-full aspect-square',
                                    search ? 'visible' : 'invisible',
                                )}
                                title="Očisti pretragu"
                                type="button"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => {
                                    shouldRestoreSearchFocusRef.current = true;
                                    setSearch('');
                                }}
                                size="sm"
                                variant="plain"
                            >
                                <Close className="size-5" />
                            </IconButton>
                        }
                        className="min-w-60"
                        variant="soft"
                    />
                )}
                {currentStep === 0 && (
                    <PlantsList search={search} onChange={handlePlantSelect} />
                )}
                {currentStep === 1 && selectedPlantId && (
                    <>
                        <Stack spacing={4} className="pb-8 md:pb-0">
                            <PlantsSortList
                                plantId={selectedPlantId}
                                selectedSortId={selectedSortId}
                                onChange={handleSortSelect}
                                search={search}
                                flyToShoppingCart={flyToShoppingCart}
                            />
                            {isSandbox ? (
                                <Stack spacing={1}>
                                    <Typography level="body2" semiBold>
                                        Starost biljke
                                    </Typography>
                                    <Row spacing={1} className="flex-wrap">
                                        {SANDBOX_AGE_PRESETS.map(
                                            (preset, presetIndex) => (
                                                <Button
                                                    key={preset.label}
                                                    variant={
                                                        presetIndex ===
                                                        sandboxAgeIndex
                                                            ? 'solid'
                                                            : 'outlined'
                                                    }
                                                    size="sm"
                                                    onClick={() =>
                                                        setSandboxAgeIndex(
                                                            presetIndex,
                                                        )
                                                    }
                                                >
                                                    {preset.label}
                                                </Button>
                                            ),
                                        )}
                                    </Row>
                                </Stack>
                            ) : (
                                <>
                                    <Row spacing={2} className="flex-wrap">
                                        <Button
                                            variant={
                                                availableFromInventory &&
                                                useInventoryItem
                                                    ? 'solid'
                                                    : 'outlined'
                                            }
                                            size="sm"
                                            disabled={!availableFromInventory}
                                            startDecorator={
                                                <BackpackIcon className="size-5 shrink-0" />
                                            }
                                            onClick={() => {
                                                track(
                                                    'game_plant_inventory_toggled',
                                                    {
                                                        garden_id: gardenId,
                                                        position_index:
                                                            positionIndex,
                                                        raised_bed_id:
                                                            raisedBedId,
                                                        sort_id: selectedSortId,
                                                        use_inventory:
                                                            !useInventoryItem,
                                                    },
                                                );
                                                setUseInventoryItem(
                                                    (previous) => !previous,
                                                );
                                            }}
                                        >
                                            {`U ruksaku (${availableFromInventory ?? 0})`}
                                        </Button>
                                    </Row>
                                    <Input
                                        type="date"
                                        label="Datum sijanja"
                                        name="plantDate"
                                        className="w-full bg-card"
                                        value={plantDate}
                                        onChange={(e) =>
                                            handlePlantDateChange(
                                                e.target.value,
                                            )
                                        }
                                        min={min}
                                        max={max}
                                    />
                                </>
                            )}
                        </Stack>
                        <Row
                            data-plant-picker-actions
                            className="-mx-4 -mb-4 sticky bottom-0 z-10 flex-wrap items-center justify-between gap-2 border-t bg-background/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-xs max-[340px]:flex-col max-[340px]:items-stretch max-[340px]:justify-start md:static md:mx-0 md:mb-0 md:flex-nowrap md:border-t-0 md:bg-transparent md:p-0 md:backdrop-blur-none"
                        >
                            <Button
                                variant="plain"
                                className="min-w-0 justify-start whitespace-nowrap px-2 max-[340px]:justify-center md:justify-start"
                                onClick={() => {
                                    setSelectedPlantId(null);
                                    resetSearch();
                                }}
                                startDecorator={<Left className="size-5" />}
                            >
                                Odabir biljke
                            </Button>
                            <Row
                                spacing={2}
                                className="min-w-0 flex-wrap justify-end max-[340px]:w-full max-[340px]:flex-col-reverse max-[340px]:items-stretch"
                            >
                                {inShoppingCart && (
                                    <Button
                                        variant="plain"
                                        className="whitespace-nowrap"
                                        loading={setCartItem.isPending}
                                        onClick={handleRemove}
                                    >
                                        Ukloni
                                    </Button>
                                )}
                                <Button
                                    variant="solid"
                                    className="whitespace-nowrap"
                                    disabled={!selectedSortId}
                                    title={
                                        !selectedSortId
                                            ? 'Odaberi sortu prije potvrde'
                                            : undefined
                                    }
                                    loading={
                                        isSandbox
                                            ? sandboxPlant.isPending
                                            : setCartItem.isPending
                                    }
                                    onClick={handleConfirm}
                                    startDecorator={
                                        isSandbox ? (
                                            <PlantingSeedIcon className="shrink-0 size-5" />
                                        ) : (
                                            <ShoppingCart className="shrink-0 size-5" />
                                        )
                                    }
                                >
                                    {isSandbox ? 'Posadi' : 'Dodaj u košaru'}
                                </Button>
                            </Row>
                        </Row>
                    </>
                )}
            </Stack>
        </Modal>
    );
}
