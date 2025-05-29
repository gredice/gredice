import { useSearchParam } from "@signalco/hooks/useSearchParam";
import { usePlants } from "../../hooks/usePlants";
import { Modal } from "@signalco/ui-primitives/Modal";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";
import { FilterInput } from "@gredice/ui/FilterInput";
import { ReactElement } from "react";
import { List } from "@signalco/ui-primitives/List";
import { Alert } from "@signalco/ui/Alert";
import { NoDataPlaceholder } from "@signalco/ui/NoDataPlaceholder";
import { Skeleton } from "@signalco/ui-primitives/Skeleton";
import { ListItem } from "@signalco/ui-primitives/ListItem";

export function PlantPicker({ trigger }: { trigger: ReactElement }) {
    const { data: plants, isLoading, isError } = usePlants();
    const [search] = useSearchParam('pretraga', '');
    const filteredPlants = search.length > 0
        ? plants?.filter(plant => plant.information.name.toLowerCase().includes(search.toLowerCase()))
        : plants;

    return (
        <Modal
            trigger={trigger}
            title={"Odabir biljke"}
            className="z-[99999999] md:border-tertiary md:border-b-4">
            <Stack spacing={2}>
                <Stack>
                    <Typography level="h3" className="text-xl">
                        Odabir biljke
                    </Typography>
                    <Typography level="body2">
                        Odaberi biljku koju želiš posaditi u gredicu.
                    </Typography>
                </Stack>
                <FilterInput searchParamName={"pretraga"} fieldName={"search"} />
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
                        <div className="p-2" key={index}>
                            <Skeleton className="w-44 h-12" />
                        </div>
                    ))}
                    {filteredPlants?.map((plant) => (
                        <ListItem
                            key={plant.id}
                            variant="outlined"
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
            </Stack>
        </Modal>
    );
}
