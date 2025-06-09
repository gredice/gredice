import { useSearchParam } from "@signalco/hooks/useSearchParam";
import { usePlants } from "../../hooks/usePlants";
import { Modal } from "@signalco/ui-primitives/Modal";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";
import { FilterInput } from "@gredice/ui/FilterInput";
import { ReactElement, useState } from "react";
import { List } from "@signalco/ui-primitives/List";
import { Alert } from "@signalco/ui/Alert";
import { NoDataPlaceholder } from "@signalco/ui/NoDataPlaceholder";
import { Skeleton } from "@signalco/ui-primitives/Skeleton";
import { ListItem } from "@signalco/ui-primitives/ListItem";
import { SegmentedProgress } from "../../controls/components/SegmentedProgress";
import { PlantData, PlantSortData } from "@gredice/client";
import { usePlantSorts } from "../../hooks/usePlantSorts";
import { Button } from "@signalco/ui-primitives/Button";
import { Input } from "@signalco/ui-primitives/Input";
import { Row } from "@signalco/ui-primitives/Row";
import { useSetShoppingCartItem } from "../../hooks/useShoppingCart";

function PlantListItemSkeleton() {
    return (
        <div className="p-2 flex flex-row gap-2">
            <Skeleton className="w-12 h-12" />
            <div className="flex flex-col gap-1">
                <Skeleton className="w-32 h-6" />
                <Skeleton className="w-44 h-5" />
            </div>
        </div>
    )
}

function PlantsSortList({ plantId, onChange }: { plantId: number, onChange: (plant: PlantSortData) => void }) {
    const { data: plantSorts, isLoading, isError } = usePlantSorts(plantId);
    const [search] = useSearchParam('pretraga', '');
    const filteredPlantSorts = search.length > 0
        ? plantSorts?.filter(sort => sort.information.name.toLowerCase().includes(search.toLowerCase()))
        : plantSorts;

    return (
        <>
            {isError && (
                <Alert color="danger">
                    Greška prilikom učitavanja sorta biljke
                </Alert>
            )}
            <List variant="outlined" className="bg-card max-h-96 overflow-y-auto">
                {!isLoading && filteredPlantSorts?.length === 0 && (
                    <NoDataPlaceholder className="p-4">
                        Nema rezultata
                    </NoDataPlaceholder>
                )}
                {isLoading && Array.from({ length: 3 }).map((_, index) => (
                    <PlantListItemSkeleton key={index} />
                ))}
                {filteredPlantSorts?.map((sort) => (
                    <ListItem
                        key={sort.id}
                        variant="outlined"
                        nodeId={sort.id.toString()}
                        onSelected={() => onChange(sort)}
                        startDecorator={(
                            <img
                                src={'https://www.gredice.com/' + (sort.image?.cover?.url ?? sort.information.plant.image?.cover?.url)}
                                alt={sort.information.name}
                                className="size-10"
                            />
                        )}
                        label={(
                            <Stack>
                                <Typography level="body1">{sort.information.name}</Typography>
                                <Typography level="body2" className="font-normal line-clamp-2 break-words">{sort.information.shortDescription}</Typography>
                            </Stack>
                        )}
                    />
                ))}
            </List>
        </>
    );
}

function PlantsList({ onChange }: { onChange: (plant: PlantData) => void }) {
    const { data: plants, isLoading, isError } = usePlants();
    const [search] = useSearchParam('pretraga', '');
    const filteredPlants = search.length > 0
        ? plants?.filter(plant => plant.information.name.toLowerCase().includes(search.toLowerCase()))
        : plants;

    return (
        <>
            {isError && (
                <Alert color="danger">
                    Greška prilikom učitavanja biljaka
                </Alert>
            )}
            <List variant="outlined" className="bg-card max-h-96 overflow-y-auto">
                {!isLoading && filteredPlants?.length === 0 && (
                    <NoDataPlaceholder className="p-4">
                        Nema rezultata
                    </NoDataPlaceholder>
                )}
                {isLoading && Array.from({ length: 3 }).map((_, index) => (
                    <PlantListItemSkeleton key={index} />
                ))}
                {filteredPlants?.map((plant) => (
                    <ListItem
                        key={plant.id}
                        variant="outlined"
                        nodeId={plant.id.toString()}
                        onSelected={() => onChange(plant)}
                        startDecorator={(
                            <img
                                src={'https://www.gredice.com/' + plant.image.cover.url}
                                alt={plant.information.name}
                                className="size-10"
                            />
                        )}
                        label={(
                            <Stack>
                                <Typography level="body1">{plant.information.name}</Typography>
                                <Typography level="body2" className="font-normal line-clamp-2 break-words">{plant.information.description}</Typography>
                            </Stack>
                        )}
                    />
                ))}
            </List>
        </>
    );
}

export function PlantPicker({ trigger }: { trigger: ReactElement }) {
    const [, setSearch] = useSearchParam('pretraga', '');
    const steps = [
        { label: 'Odabir biljke', subHeader: 'Odaberi biljku koju želiš posaditi' },
        { label: 'Odabir sorte', subHeader: 'Odaberi sortu biljke koju želiš posaditi' },
        { label: 'Opcije', subHeader: 'Dodatne opcije sadnje biljke' },
    ];
    const cartItem = useSetShoppingCartItem();

    // Steap 1: select plant
    const [selectedPlant, setSelectedPlant] = useState<PlantData | null>(null);

    // Step 2: select sort
    const [selectedSort, setSelectedSort] = useState<PlantSortData | null>(null);

    // Step 3: options
    const [plantDate, setPlantDate] = useState<string>(new Date().toISOString().split('T')[0]);

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

    async function handlePlantOptions(options: { plantDate: Date }) {
        if (!selectedSort) {
            return;
        }
        await cartItem.mutateAsync({
            entityTypeName: selectedSort.entityType.name,
            entityId: selectedSort.id.toString(),
            amount: 1
        });
    }

    function handleOpenChange(open: boolean) {
        if (!open) {
            setSelectedPlant(null);
            setSelectedSort(null);
            setSearch(undefined);
        }
    }

    return (
        <Modal
            trigger={trigger}
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
                {currentStep === 0 && <PlantsList onChange={handlePlantSelect} />}
                {(currentStep === 1 && selectedPlant) && (
                    <PlantsSortList
                        plantId={selectedPlant.id}
                        onChange={(sort) => {
                            handleSortSelect(sort);
                            setSearch(undefined);
                        }} />
                )}
                {currentStep === 2 && selectedSort && (
                    <Stack spacing={2}>
                        <Row spacing={1} className="bg-card rounded-md border p-2">
                            <img
                                src={'https://www.gredice.com/' + (selectedSort.image?.cover?.url ?? selectedSort.information.plant.image?.cover?.url)}
                                alt={selectedSort.information.name}
                                className="size-10"
                            />
                            <Typography level="body1">
                                {selectedSort.information.name}
                            </Typography>
                        </Row>
                        <Input
                            type="date"
                            label="Datum sadnje"
                            name="plantDate"
                            className="w-full"
                            value={plantDate}
                            onChange={(e) => setPlantDate(e.target.value)}
                            // Tomorrow's date as default and minimum date
                            // max is 3 months from now
                            min={new Date().toISOString().split('T')[0]}
                            max={new Date(new Date().setMonth(new Date().getMonth() + 3)).toISOString().split('T')[0]}
                        />
                        <Button
                            variant="solid"
                            onClick={() => handlePlantOptions({ plantDate: new Date(plantDate) })}>
                            Potvrdi sadnju
                        </Button>
                    </Stack>
                )}
            </Stack>
        </Modal>
    );
}
