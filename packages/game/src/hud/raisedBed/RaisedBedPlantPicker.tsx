import { useSearchParam } from "@signalco/hooks/useSearchParam";
import { Modal } from "@signalco/ui-primitives/Modal";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";
import { FilterInput } from "@gredice/ui/FilterInput";
import { ReactElement, useState } from "react";
import { SegmentedProgress } from "../../controls/components/SegmentedProgress";
import { PlantData, PlantSortData } from "@gredice/client";
import { useShoppingCart } from "../../hooks/useShoppingCart";
import { PlantsList } from "./PlantsList";
import { PlantsSortList } from "./PlantsSortList";
import { PlantPickerOptions } from "./PlantPickerOptions";
import { useSetShoppingCartItem } from "../../hooks/useSetShoppingCartItem";
import { Row } from "@signalco/ui-primitives/Row";
import { Button } from "@signalco/ui-primitives/Button";
import { Left, ShoppingCart } from "@signalco/ui-icons";

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
    selectedPlantOptions: preselectedPlantOptions
}: PlantPickerProps) {
    const [open, setOpen] = useState(false);
    const [, setSearch] = useSearchParam('pretraga', '');
    const steps = [
        { label: 'Odabir biljke', subHeader: 'Odaberi biljku koju želiš posaditi' },
        { label: 'Odabir sorte', subHeader: 'Odaberi sortu biljke koju želiš posaditi' },
        { label: 'Opcije', subHeader: 'Dodatne opcije sadnje biljke' },
    ];
    const { data: cart } = useShoppingCart();
    const setCartItem = useSetShoppingCartItem();
    const [selectedPlantId, setSelectedPlantId] = useState<number | null>(preselectedPlantId ?? null);
    const [selectedSortId, setSelectedSortId] = useState<number | null>(preselectedSortId ?? null);
    const [plantOptions, setPlantOptions] = useState<{ scheduledDate: Date | null | undefined } | null>(preselectedPlantOptions ?? null);

    let currentStep = 0;
    if (selectedSortId) {
        currentStep = 2;
    } else if (selectedPlantId) {
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

    function handlePlantOptionsChange(options: { scheduledDate: Date | null | undefined }) {
        setPlantOptions(options);
    }

    async function removeFromCart() {
        // Remove existing item if it exists in cart already
        const existingItem = cart?.items.find(item =>
            item.entityTypeName === "plantSort" &&
            item.gardenId === gardenId &&
            item.raisedBedId === raisedBedId &&
            item.positionIndex === positionIndex
        );
        if (existingItem) {
            await setCartItem.mutateAsync({
                ...existingItem,
                gardenId: existingItem.gardenId ?? undefined,
                raisedBedId: existingItem.raisedBedId ?? undefined,
                positionIndex: existingItem.positionIndex ?? undefined,
                amount: 0
            });
        };
    }

    async function handleRemove() {
        setOpen(false);
        setSelectedPlantId(null);
        setSelectedSortId(null);
        setPlantOptions(null);
        setSearch(undefined);
        await removeFromCart();
    }

    async function handleConfirm() {
        if (!selectedSortId) {
            return;
        }

        await removeFromCart();

        // Add new item to cart
        await setCartItem.mutateAsync({
            entityTypeName: "plantSort",
            entityId: selectedSortId?.toString(),
            amount: 1,
            gardenId,
            raisedBedId,
            positionIndex,
            additionalData: JSON.stringify({
                scheduledDate: plantOptions?.scheduledDate?.toISOString(),
            })
        });
        setOpen(false);
    }

    function handleOpenChange(open: boolean) {
        setOpen(open);
    }

    console.log('currentStep', currentStep);
    console.log('selectedPlantId', selectedPlantId);
    console.log('selectedSortId', selectedSortId);
    console.log('plantOptions', plantOptions);

    return (
        <Modal
            trigger={trigger}
            open={open}
            onOpenChange={handleOpenChange}
            title={"Sijanje biljke"}
            className="z-[99999999] md:border-tertiary md:border-b-4">
            <Stack spacing={2}>
                <SegmentedProgress
                    className="pb-4 pl-4 pr-8"
                    segments={steps.map((step, stepIndex) => ({
                        value: currentStep > stepIndex ? 100 : (currentStep < stepIndex ? 0 : 99),
                        highlighted: stepIndex === currentStep,
                        label: step.label,
                    }))} />
                <Stack>
                    <Typography level="h3" className="text-xl">
                        {steps[currentStep].label}
                    </Typography>
                    <Typography level="body2">
                        {steps[currentStep].subHeader}
                    </Typography>
                </Stack>
                {currentStep < 2 && <FilterInput searchParamName={"pretraga"} fieldName={"search"} />}
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
                {(currentStep === 1 && selectedPlantId) && (
                    <>
                        <PlantsSortList
                            plantId={selectedPlantId}
                            onChange={(sort) => {
                                handleSortSelect(sort);
                                setSearch(undefined);
                            }} />
                        <Row>
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
                        </Row>
                    </>
                )}
                {currentStep === 2 && selectedPlantId && selectedSortId && (
                    <>
                        <PlantPickerOptions
                            selectedPlantId={selectedPlantId}
                            selectedSortId={selectedSortId}
                            onChange={handlePlantOptionsChange} />
                        <Row justifyContent="space-between">
                            <Button
                                variant="plain"
                                onClick={() => {
                                    setSelectedSortId(null);
                                    setSearch(undefined);
                                }}
                                startDecorator={<Left className="size-5" />}
                            >
                                Odabir sorte
                            </Button>
                            <Row spacing={1}>
                                {inShoppingCart && (
                                    <Button
                                        variant="plain"
                                        onClick={handleRemove}>
                                        Ukloni
                                    </Button>
                                )}
                                <Button
                                    variant="solid"
                                    onClick={handleConfirm}
                                    startDecorator={<ShoppingCart className="shrink-0 size-5" />}
                                >
                                    Potvrdi sadnju
                                </Button>
                            </Row>
                        </Row>
                    </>
                )}
            </Stack>
        </Modal>
    );
}
