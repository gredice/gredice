import { useSearchParam } from "@signalco/hooks/useSearchParam";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";
import { List } from "@signalco/ui-primitives/List";
import { Alert } from "@signalco/ui/Alert";
import { NoDataPlaceholder } from "@signalco/ui/NoDataPlaceholder";
import { PlantSortData } from "@gredice/client";
import { usePlantSorts } from "../../hooks/usePlantSorts";
import { PlantListItemSkeleton } from "./PlantListItemSkeleton";
import { KnownPages } from "../../knownPages";
import { Check } from "@signalco/ui-icons";
import { Row } from "@signalco/ui-primitives/Row";
import { Button } from "@signalco/ui-primitives/Button";
import { useEffect } from "react";
import { cx } from "@signalco/ui-primitives/cx";

export function PlantsSortList({ plantId, selectedSortId, onChange }: { plantId: number, selectedSortId: number | null, onChange: (plant: PlantSortData) => void }) {
    const { data: plantSorts, isLoading, isError } = usePlantSorts(plantId);
    const [search] = useSearchParam('pretraga', '');
    const filteredPlantSorts = search.length > 0
        ? plantSorts?.filter(sort => sort.information.name.toLowerCase().includes(search.toLowerCase()))
        : plantSorts;

    // Select first sort if only one is available
    useEffect(() => {
        if (filteredPlantSorts?.length === 1 && !selectedSortId) {
            onChange(filteredPlantSorts[0]);
        }
    }, [filteredPlantSorts, selectedSortId, onChange]);

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
                    <Stack key={sort.id} className={cx(
                        selectedSortId === sort.id && 'bg-muted'
                    )}>
                        <Button
                            // variant={selectedSortId === sort.id ? "soft" : "plain"}
                            variant="plain"
                            className={cx(
                                "justify-between text-start p-0 h-auto py-2 gap-3 px-4 rounded-none font-normal"
                            )}
                            onClick={() => onChange(sort)}>
                            <Row spacing={1.5}>
                                <img
                                    src={'https://www.gredice.com/' + (sort.image?.cover?.url ?? sort.information.plant.image?.cover?.url)}
                                    alt={sort.information.name}
                                    width={48}
                                    height={48}
                                    className="size-12" />
                                <Stack>
                                    <Typography level="body1" semiBold>{sort.information.name}</Typography>
                                    <Typography level="body2" className="font-normal line-clamp-2 break-words">{sort.information.shortDescription ?? sort.information.plant.information?.description}</Typography>
                                </Stack>
                            </Row>
                            {selectedSortId === sort.id && (
                                <Check
                                    className="size-5 shrink-0"
                                    title="Odabrano"
                                />
                            )}
                        </Button>
                        <Row justifyContent="end" className="px-4">
                            <Button
                                title="Više informacija"
                                href={KnownPages.GredicePlantSort(sort.information.plant.information?.name ?? 'nepoznato', sort.information.name)}
                                variant="link"
                                size="sm"
                            >
                                Više informacija...
                            </Button>
                        </Row>
                    </Stack>
                ))}
            </List>
        </>
    );
}
