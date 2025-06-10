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
import { KnownPages } from "../../knownPages";
import { Link } from "@signalco/ui-primitives/Link";

export function PlantsList({ onChange }: { onChange: (plant: PlantData) => void }) {
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
                        endDecorator={(
                            <Link href={KnownPages.GredicePlant(plant.information.name)}>
                                <IconButton
                                    title="Više informacija"
                                    variant="soft"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                    }}>
                                    <Info className="size-5" />
                                </IconButton>
                            </Link>
                        )}
                    />
                ))}
            </List>
        </>
    );
}
