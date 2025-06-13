import { useSearchParam } from "@signalco/hooks/useSearchParam";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";
import { List } from "@signalco/ui-primitives/List";
import { Alert } from "@signalco/ui/Alert";
import { NoDataPlaceholder } from "@signalco/ui/NoDataPlaceholder";
import { ListItem } from "@signalco/ui-primitives/ListItem";
import { PlantSortData } from "@gredice/client";
import { usePlantSorts } from "../../hooks/usePlantSorts";
import { PlantListItemSkeleton } from "./PlantListItemSkeleton";
import { KnownPages } from "../../knownPages";
import { Link } from "@signalco/ui-primitives/Link";
import { IconButton } from "@signalco/ui-primitives/IconButton";
import { Info } from "@signalco/ui-icons";
import { Row } from "@signalco/ui-primitives/Row";

export function PlantsSortList({ plantId, onChange }: { plantId: number, onChange: (plant: PlantSortData) => void }) {
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
                    <Row key={sort.id}>
                        <ListItem
                            variant="outlined"
                            className="rounded-r-lg"
                            nodeId={sort.id.toString()}
                            onSelected={() => onChange(sort)}
                            startDecorator={(
                                <img
                                    src={'https://www.gredice.com/' + (sort.image?.cover?.url ?? sort.information.plant.image?.cover?.url)}
                                    alt={sort.information.name}
                                    className="size-10" />
                            )}
                            label={(
                                <Stack>
                                    <Typography level="body1">{sort.information.name}</Typography>
                                    <Typography level="body2" className="font-normal line-clamp-2 break-words">{sort.information.shortDescription}</Typography>
                                </Stack>
                            )} />
                        <Link
                            href={KnownPages.GredicePlantSort(sort.information.plant.information?.name ?? 'nepoznato', sort.information.name)}
                            className="mx-2">
                            <IconButton
                                title="Više informacija"
                                variant="soft">
                                <Info className="size-5" />
                            </IconButton>
                        </Link>
                    </Row>
                ))}
            </List>
        </>
    );
}
