import { useSearchParam } from "@signalco/hooks/useSearchParam";
import { usePlants } from "../../hooks/usePlants";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";
import { List } from "@signalco/ui-primitives/List";
import { Alert } from "@signalco/ui/Alert";
import { NoDataPlaceholder } from "@signalco/ui/NoDataPlaceholder";
import { ListItem } from "@signalco/ui-primitives/ListItem";
import { PlantData } from "@gredice/client";
import { PlantListItemSkeleton } from "./PlantListItemSkeleton";
import { IconButton } from "@signalco/ui-primitives/IconButton";
import { Info } from "@signalco/ui-icons";
import { PlantRecommendedBadge, PlantYieldTooltip } from "@gredice/ui/plants";
import { KnownPages } from "../../knownPages";
import { Link } from "@signalco/ui-primitives/Link";
import { Row } from "@signalco/ui-primitives/Row";
import { Chip } from "@signalco/ui-primitives/Chip";

export function PlantsList({ onChange }: { onChange: (plant: PlantData) => void }) {
    const { data: plants, isLoading, isError } = usePlants();
    const [search] = useSearchParam('pretraga', '');
    // Filter plants based on search query
    const filteredPlants = search.length > 0
        ? plants?.filter(plant => plant.information.name.toLowerCase().includes(search.toLowerCase()))
        : plants;

    // Mark and sort recommended plants
    const sortedPlants = filteredPlants?.sort((a, b) => {
        const aRec = a.isRecommended ? 1 : 0;
        const bRec = b.isRecommended ? 1 : 0;
        return bRec - aRec;
    });

    return (
        <>
            {isError && (
                <Alert color="danger">
                    Greška prilikom učitavanja biljaka
                </Alert>
            )}
            <List variant="outlined" className="bg-card max-h-96 overflow-y-auto">
                {!isLoading && sortedPlants?.length === 0 && (
                    <NoDataPlaceholder className="p-4">
                        Nema rezultata
                    </NoDataPlaceholder>
                )}
                {isLoading && Array.from({ length: 3 }).map((_, index) => (
                    <PlantListItemSkeleton key={index} />
                ))}
                {sortedPlants?.map((plant) => {
                    let plantsPerRow = Math.floor(30 / (plant.attributes?.seedingDistance ?? 30));
                    if (plantsPerRow < 1) {
                        console.warn(`Plants per row is less than 1 (${plantsPerRow}) for ${plant.information.name}. Setting to 1.`);
                        plantsPerRow = 1;
                    }
                    const totalPlants = Math.floor(plantsPerRow * plantsPerRow);
                    const price = plant.prices?.perPlant ? plant.prices.perPlant.toFixed(2) : 'Nepoznato';
                    const yieldMin = plant.attributes?.yieldMin ?? 0;
                    const yieldMax = plant.attributes?.yieldMax ?? 0;
                    const yieldType = plant.attributes?.yieldType ?? 'perField';
                    const expectedYieldAverage = (yieldMax - yieldMin) / 2 + yieldMin;
                    const expectedYieldPerField = yieldType === 'perField' ? expectedYieldAverage : expectedYieldAverage * totalPlants;
                    return (
                        <Row key={plant.id}>
                            <ListItem
                                className="rounded-none rounded-r"
                                nodeId={plant.id.toString()}
                                onSelected={() => onChange(plant)}
                                startDecorator={(
                                    <img
                                        src={'https://www.gredice.com/' + plant.image.cover.url}
                                        alt={plant.information.name}
                                        width={40}
                                        height={40}
                                        className="size-10" />
                                )}
                                label={(
                                    <Stack className="pr-1">
                                        <Typography level="body1">
                                            {plant.information.name}{' '}
                                            <PlantRecommendedBadge isRecommended={plant.isRecommended} size="sm" />
                                        </Typography>
                                        <Typography level="body2" className="font-normal line-clamp-2 break-words">
                                            {plant.information.description}
                                        </Typography>
                                        <Row spacing={1} className="mt-1">
                                            <Chip size="sm">
                                                <PlantYieldTooltip plant={plant}>
                                                    Prinos ~{(expectedYieldPerField / 1000).toFixed(1)} kg
                                                </PlantYieldTooltip>
                                            </Chip>
                                            <Chip size="sm">
                                                {totalPlants} {totalPlants === 1 ? 'biljka' : (totalPlants < 5 ? 'biljke' : 'biljaka')}
                                            </Chip>
                                        </Row>
                                    </Stack>
                                )}
                                endDecorator={(
                                    <span>{price}€</span>
                                )} />
                            <Link href={KnownPages.GredicePlant(plant.information.name)}
                                className="mx-2">
                                <IconButton
                                    title="Više informacija"
                                    variant="soft"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                    }}>
                                    <Info className="size-5" />
                                </IconButton>
                            </Link>
                        </Row>
                    );
                })}
            </List>
        </>
    );
}
