import type { PlantData, PlantSortData } from '@gredice/client';
import { FilterInput } from '@gredice/ui/FilterInput';
import { useSearchParam } from '@signalco/hooks/useSearchParam';
import { Left, ShoppingCart } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { Input } from '@signalco/ui-primitives/Input';
import { Modal } from '@signalco/ui-primitives/Modal';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { type ReactElement, useState } from 'react';
import { SegmentedProgress } from '../../controls/components/SegmentedProgress';
import { useInventory } from '../../hooks/useInventory';
import { useSetShoppingCartItem } from '../../hooks/useSetShoppingCartItem';
import {
    type ShoppingCartItemData,
    useShoppingCart,
} from '../../hooks/useShoppingCart';
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
    const [, setSearch] = useSearchParam('pretraga', '');
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

    let currentStep = 0;
    if (selectedPlantId) {
        currentStep = 1;
    }

    function handlePlantSelect(plant: PlantData) {
        setSelectedPlantId(plant.id);
        setSelectedSortId(null);
        setSearch(undefined);
    }

    function handleSortSelect(sort: PlantSortData) {
        setSelectedSortId(sort.id);
        setSearch(undefined);
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
        setOpen(false);
        setSelectedPlantId(null);
        setSelectedSortId(null);
        setPlantOptions(null);
        setUseInventoryItem(false);
        setSearch(undefined);
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
        setFlyToShoppingCart(true);
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
        setOpen(false);
        setFlyToShoppingCart(false);
    }

    function handleOpenChange(open: boolean) {
        setOpen(open);
        setSelectedPlantId(preselectedPlantId ?? null);
        setSelectedSortId(preselectedSortId ?? null);
        setPlantOptions(preselectedPlantOptions ?? null);
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
        (item: any) =>
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
                                      setSearch(undefined);
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
                    <FilterInput
                        searchParamName={'pretraga'}
                        fieldName={'search'}
                    />
                )}
                {currentStep === 0 && (
                    <>
                        <PlantsList onChange={handlePlantSelect} />
                        <Row>
                            <Button
                                variant="plain"
                                onClick={() => {
                                    setOpen(false);
                                }}
                                startDecorator={<Left className="size-5" />}
                            >
                                Odustani
                            </Button>
                        </Row>
                    </>
                )}
                {currentStep === 1 && selectedPlantId && (
                    <>
                        <Stack spacing={2}>
                            <PlantsSortList
                                plantId={selectedPlantId}
                                selectedSortId={selectedSortId}
                                onChange={(sort) => {
                                    handleSortSelect(sort);
                                    setSearch(undefined);
                                }}
                                flyToShoppingCart={flyToShoppingCart}
                            />
                            <Row spacing={1} className="flex-wrap">
                                <Button
                                    variant={
                                        useInventoryItem ? 'solid' : 'outlined'
                                    }
                                    size="sm"
                                    disabled={!availableFromInventory}
                                    onClick={() =>
                                        setUseInventoryItem(
                                            (previous) => !previous,
                                        )
                                    }
                                >
                                    {availableFromInventory
                                        ? `Iskoristi iz ruksaka (${availableFromInventory})`
                                        : 'Nema u ruksaku'}
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
                                    setSearch(undefined);
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
                                    Potvrdi sijanje
                                </Button>
                            </Row>
                        </Row>
                    </>
                )}
            </Stack>
        </Modal>
    );
}
