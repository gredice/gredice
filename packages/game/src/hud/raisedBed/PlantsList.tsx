import type { PlantData } from '@gredice/client';
import { calculatePlantsPerField } from '@gredice/js/plants';
import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { Chip } from '@gredice/ui/Chip';
import { List } from '@gredice/ui/List';
import { NoDataPlaceholder } from '@gredice/ui/NoDataPlaceholder';
import {
    PlantOrSortImage,
    PlantYieldTooltip,
    SeedTimeInformationBadge,
} from '@gredice/ui/plants';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useGameAnalytics } from '../../analytics/GameAnalyticsContext';
import { usePlants } from '../../hooks/usePlants';
import { KnownPages } from '../../knownPages';
import { PlantListItemSkeleton } from './PlantListItemSkeleton';

type PlantSearchable = {
    information: {
        name?: string | null;
        label?: string | null;
        alternativeName?: string[] | null;
    };
};

function normalizePlantSearchText(value: string | null | undefined) {
    return (value ?? '')
        .replace(/[Đđ]/g, 'd')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase('hr-HR')
        .trim();
}

function plantMatchesSearch(plant: PlantSearchable, normalizedSearch: string) {
    return [
        plant.information.name,
        plant.information.label,
        ...(plant.information.alternativeName ?? []),
    ].some((value) =>
        normalizePlantSearchText(value).includes(normalizedSearch),
    );
}

export function PlantsList({
    onChange,
    search,
}: {
    onChange: (plant: PlantData) => void;
    search: string;
}) {
    const { track } = useGameAnalytics();
    const { data: plants, isLoading, isError } = usePlants();
    const normalizedSearch = normalizePlantSearchText(search);
    // Filter plants based on search query
    const filteredPlants =
        normalizedSearch.length > 0
            ? plants?.filter((plant) =>
                  plantMatchesSearch(plant, normalizedSearch),
              )
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
                <Alert color="danger">Greška prilikom učitavanja biljaka</Alert>
            )}
            <List
                variant="outlined"
                className="max-h-[40dvh] overflow-y-auto bg-card md:max-h-96"
            >
                {!isLoading && sortedPlants?.length === 0 && (
                    <NoDataPlaceholder className="p-4">
                        Nema rezultata
                    </NoDataPlaceholder>
                )}
                {isLoading &&
                    Array.from({ length: 3 }).map((_, index) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: Allowed, skeleton
                        <PlantListItemSkeleton key={index} />
                    ))}
                {sortedPlants?.map((plant) => {
                    const { totalPlants } = calculatePlantsPerField(
                        plant.attributes?.seedingDistance,
                    );
                    const price = plant.prices?.perPlant
                        ? plant.prices.perPlant.toFixed(2)
                        : 'Nepoznato';
                    return (
                        <Stack key={plant.id}>
                            <Button
                                variant="plain"
                                className="justify-start text-start p-0 h-auto py-2 gap-3 px-4 rounded-none font-normal"
                                onClick={() => {
                                    track('game_plant_selected', {
                                        is_recommended: plant.isRecommended,
                                        plant_id: plant.id,
                                        plant_name: plant.information.name,
                                    });
                                    onChange(plant);
                                }}
                            >
                                <PlantOrSortImage
                                    plant={plant}
                                    width={48}
                                    height={48}
                                    className="size-12"
                                />
                                <Stack>
                                    <Row
                                        spacing={2}
                                        justifyContent="space-between"
                                    >
                                        <Typography level="body1" semiBold>
                                            {plant.information.name}
                                        </Typography>
                                        <Typography level="body1" semiBold>
                                            {price} €
                                        </Typography>
                                    </Row>
                                    <Typography
                                        level="body2"
                                        className="line-clamp-2 break-words"
                                    >
                                        {plant.information.description}
                                    </Typography>
                                </Stack>
                            </Button>
                            <div className="flex flex-wrap gap-y-1 gap-x-2 px-4 items-center justify-end">
                                <Chip size="sm">
                                    <PlantYieldTooltip plant={plant}>
                                        Prinos
                                    </PlantYieldTooltip>
                                </Chip>
                                <Chip size="sm">
                                    {totalPlants}{' '}
                                    {totalPlants === 1
                                        ? 'biljka'
                                        : totalPlants < 5
                                          ? 'biljke'
                                          : 'biljaka'}
                                </Chip>
                                {plant.isRecommended && (
                                    <SeedTimeInformationBadge size="sm" />
                                )}
                                <Button
                                    title="Više informacija"
                                    variant="link"
                                    size="sm"
                                    href={KnownPages.GredicePlant(
                                        plant.information.name,
                                    )}
                                    onClick={() =>
                                        track('game_plant_details_opened', {
                                            plant_id: plant.id,
                                            plant_name: plant.information.name,
                                        })
                                    }
                                >
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
