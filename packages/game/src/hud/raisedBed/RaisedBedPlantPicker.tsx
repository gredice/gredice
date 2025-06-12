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
import { Check, Left, ShoppingCart } from "@signalco/ui-icons";

type PlantPickerProps = {
    positionIndex: number;
    gardenId: number;
    raisedBedId: number;
    trigger: ReactElement;
};

export function PlantPicker({ gardenId, raisedBedId, positionIndex, trigger }: PlantPickerProps) {
    const [open, setOpen] = useState(false);
    const [, setSearch] = useSearchParam('pretraga', '');
    const steps = [
        { label: 'Odabir biljke', subHeader: 'Odaberi biljku koju želiš posaditi' },
        { label: 'Odabir sorte', subHeader: 'Odaberi sortu biljke koju želiš posaditi' },
        { label: 'Opcije', subHeader: 'Dodatne opcije sadnje biljke' },
    ];
    const { data: cart } = useShoppingCart();
    const setCartItem = useSetShoppingCartItem();
    const [selectedPlant, setSelectedPlant] = useState<PlantData | null>(null);
    const [selectedSort, setSelectedSort] = useState<PlantSortData | null>(null);
    const [plantOptions, setPlantOptions] = useState<{ scheduledDate: Date | null | undefined } | null>(null);

    let currentStep = 0;
    if (selectedPlant) {
        currentStep = 1;
    }
    if (selectedSort) {
        currentStep = 2;
    }

    function handlePlantSelect(plant: PlantData) {
        setSelectedPlant(plant);
        setSelectedSort(null);
        setSearch(undefined);
    }

    function handleSortSelect(sort: PlantSortData) {
        setSelectedSort(sort);
        setSearch(undefined);
    }

    function handlePlantOptionsChange(options: { scheduledDate: Date | null | undefined }) {
        setPlantOptions(options);
    }

    async function handleConfirm() {
        if (!selectedSort) {
            return;
        }

        const existingItem = cart?.items.find(item =>
            item.entityTypeName === selectedSort.entityType.name &&
            item.entityId === selectedSort.id.toString() &&
            item.gardenId === gardenId &&
            item.raisedBedId === raisedBedId &&
            item.positionIndex === positionIndex
        );

        await setCartItem.mutateAsync({
            entityTypeName: selectedSort.entityType.name,
            entityId: selectedSort.id.toString(),
            amount: (existingItem?.amount ?? 0) + 1,
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

    return (
        <Modal
            trigger={trigger}
            open={open}
            onOpenChange={handleOpenChange}
            title={"Odabir biljke"}
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
                                variant="outlined"
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
                {(currentStep === 1 && selectedPlant) && (
                    <>
                        <PlantsSortList
                            plantId={selectedPlant.id}
                            onChange={(sort) => {
                                handleSortSelect(sort);
                                setSearch(undefined);
                            }} />
                        <Row>
                            <Button
                                variant="outlined"
                                onClick={() => {
                                    setSelectedPlant(null);
                                    setSearch(undefined);
                                }}
                                startDecorator={<Left className="size-5" />}
                            >
                                Odabir biljke
                            </Button>
                        </Row>
                    </>
                )}
                {currentStep === 2 && selectedSort && (
                    <>
                        <PlantPickerOptions
                            selectedSort={selectedSort}
                            onChange={handlePlantOptionsChange} />
                        <Row justifyContent="space-between">
                            <Button
                                variant="outlined"
                                onClick={() => {
                                    setSelectedSort(null);
                                    setSearch(undefined);
                                }}
                                startDecorator={<Left className="size-5" />}
                            >
                                Odabir sorte
                            </Button>
                            <Button
                                variant="solid"
                                onClick={handleConfirm}
                                startDecorator={<ShoppingCart className="size-5" />}
                            >
                                Potvrdi sadnju
                            </Button>
                        </Row>
                    </>
                )}
            </Stack>
        </Modal>
    );
}
