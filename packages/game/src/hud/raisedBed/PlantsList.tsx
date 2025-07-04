import { useSearchParam } from "@signalco/hooks/useSearchParam";
import { usePlants } from "../../hooks/usePlants";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";
import { List } from "@signalco/ui-primitives/List";
import { Alert } from "@signalco/ui/Alert";
import { NoDataPlaceholder } from "@signalco/ui/NoDataPlaceholder";
import { PlantData } from "@gredice/client";
import { PlantListItemSkeleton } from "./PlantListItemSkeleton";
import { PlantYieldTooltip, SeedTimeInformationBadge } from "@gredice/ui/plants";
import { KnownPages } from "../../knownPages";
import { Row } from "@signalco/ui-primitives/Row";
import { Chip } from "@signalco/ui-primitives/Chip";
import { Button } from "@signalco/ui-primitives/Button";

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
                    return (
                        <Stack key={plant.id}>
                            <Button
                                variant="plain"
                                className="justify-start text-start p-0 h-auto py-2 gap-3 px-4 rounded-none font-normal"
                                onClick={() => onChange(plant)}>
                                <img
                                    src={'https://www.gredice.com/' + plant.image.cover.url}
                                    alt={plant.information.name}
                                    width={48}
                                    height={48}
                                    className="size-12" />
                                <Stack>
                                    <Row spacing={1} justifyContent="space-between">
                                        <Typography level="body1" semiBold>
                                            {plant.information.name}
                                        </Typography>
                                        <Typography level="body1" semiBold>{price} €</Typography>
                                    </Row>
                                    <Typography level="body2" className="line-clamp-2 break-words">
                                        {plant.information.description}
                                    </Typography>
                                </Stack>
                            </Button>
                            <div className="flex flex-wrap gap-y-1 gap-x-2 px-4 items-center justify-end">
                                <Chip size="sm">
                                    <PlantYieldTooltip plant={plant}>Prinos</PlantYieldTooltip>
                                </Chip>
                                <Chip size="sm">
                                    {totalPlants} {totalPlants === 1 ? 'biljka' : (totalPlants < 5 ? 'biljke' : 'biljaka')}
                                </Chip>
                                {plant.isRecommended && <SeedTimeInformationBadge size="sm" />}
                                <Button
                                    title="Više informacija"
                                    variant="link"
                                    size="sm"
                                    href={KnownPages.GredicePlant(plant.information.name)}>
                                    Više informacija...
                                </Button>
                            </div>
                        </Stack>
                    );
                })}
            </List>
        </>
    );
}
