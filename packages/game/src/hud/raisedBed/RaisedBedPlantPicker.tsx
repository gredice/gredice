import type { PlantData, PlantSortData } from '@gredice/client';
import { BackpackIcon } from '@gredice/ui/BackpackIcon';
import { Close, Left, Search, ShoppingCart } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { cx } from '@signalco/ui-primitives/cx';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { Input } from '@signalco/ui-primitives/Input';
import { Modal } from '@signalco/ui-primitives/Modal';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
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
import { useInventory } from '../../hooks/useInventory';
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
            <Stack spacing={2}>
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
                        <Stack spacing={2}>
                            <PlantsSortList
                                plantId={selectedPlantId}
                                selectedSortId={selectedSortId}
                                onChange={handleSortSelect}
                                search={search}
                                flyToShoppingCart={flyToShoppingCart}
                            />
                            <Row spacing={1} className="flex-wrap">
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
                                        track('game_plant_inventory_toggled', {
                                            garden_id: gardenId,
                                            position_index: positionIndex,
                                            raised_bed_id: raisedBedId,
                                            sort_id: selectedSortId,
                                            use_inventory: !useInventoryItem,
                                        });
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
                                    handlePlantDateChange(e.target.value)
                                }
                                min={min}
                                max={max}
                            />
                        </Stack>
                        <Row justifyContent="space-between">
                            <Button
                                variant="plain"
                                onClick={() => {
                                    setSelectedPlantId(null);
                                    resetSearch();
                                }}
                                startDecorator={<Left className="size-5" />}
                            >
                                Odabir biljke
                            </Button>
                            <Row spacing={1}>
                                {inShoppingCart && (
                                    <Button
                                        variant="plain"
                                        loading={setCartItem.isPending}
                                        onClick={handleRemove}
                                    >
                                        Ukloni
                                    </Button>
                                )}
                                <Button
                                    variant="solid"
                                    disabled={!selectedSortId}
                                    title={
                                        !selectedSortId
                                            ? 'Odaberi sortu prije potvrde'
                                            : undefined
                                    }
                                    loading={setCartItem.isPending}
                                    onClick={handleConfirm}
                                    startDecorator={
                                        <ShoppingCart className="shrink-0 size-5" />
                                    }
                                >
                                    Dodaj u košaru
                                </Button>
                            </Row>
                        </Row>
                    </>
                )}
            </Stack>
        </Modal>
    );
}
