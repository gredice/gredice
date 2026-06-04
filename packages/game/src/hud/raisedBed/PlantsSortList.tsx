import type { PlantSortData } from '@gredice/client';
import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { Check } from '@gredice/ui/icons';
import { List } from '@gredice/ui/List';
import { NoDataPlaceholder } from '@gredice/ui/NoDataPlaceholder';
import { PlantOrSortImage } from '@gredice/ui/plants';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import { useEffect } from 'react';
import { useGameAnalytics } from '../../analytics/GameAnalyticsContext';
import { usePlantSorts } from '../../hooks/usePlantSorts';
import {
    AnimateFlyToItem,
    useAnimateFlyToShoppingCart,
} from '../../indicators/AnimateFlyTo';
import { KnownPages } from '../../knownPages';
import { PlantListItemSkeleton } from './PlantListItemSkeleton';
import { PlantRelationshipSignalChips } from './PlantsList';
import {
    getPlantRelationshipCandidateForSort,
    getPlantRelationshipSignal,
    type NeighborPlantSummary,
} from './plantRelationshipSignals';

type PlantsSortListProps = {
    plantId: number;
    selectedSortId: number | null;
    onChange: (plant: PlantSortData) => void;
    search: string;
    flyToShoppingCart?: boolean;
    neighborPlants?: NeighborPlantSummary[];
};

function PlantSortListItem({
    sort,
    selectedSortId,
    onChange,
    flyToShoppingCart,
    neighborPlants,
}: {
    sort: PlantSortData;
    selectedSortId: number | null;
    onChange: (sort: PlantSortData) => void;
    flyToShoppingCart?: boolean;
    neighborPlants: NeighborPlantSummary[];
}) {
    const animateFlyToShoppingCart = useAnimateFlyToShoppingCart();
    const { track } = useGameAnalytics();
    const relationshipCandidate = getPlantRelationshipCandidateForSort(sort);
    const relationshipSignal = relationshipCandidate
        ? getPlantRelationshipSignal({
              candidate: relationshipCandidate,
              neighborPlants,
          })
        : null;

    useEffect(() => {
        if (flyToShoppingCart) {
            animateFlyToShoppingCart.run();
        } else {
            animateFlyToShoppingCart.reset();
        }
    }, [
        flyToShoppingCart,
        animateFlyToShoppingCart.reset,
        animateFlyToShoppingCart.run,
    ]);

    return (
        <Stack className={cx(selectedSortId === sort.id && 'bg-muted')}>
            <Button
                // variant={selectedSortId === sort.id ? "soft" : "plain"}
                variant="plain"
                className={cx(
                    'justify-between text-start p-0 h-auto py-2 gap-3 px-4 rounded-none font-normal',
                )}
                onClick={() => {
                    track('game_plant_sort_selected', {
                        plant_name: sort.information.plant.information?.name,
                        sort_id: sort.id,
                        sort_name: sort.information.name,
                        ...(relationshipSignal?.status &&
                        relationshipSignal.status !== 'neutral'
                            ? {
                                  relationship_neighbor_plant_ids:
                                      relationshipSignal.neighborPlantIds.join(
                                          ',',
                                      ),
                                  relationship_signal:
                                      relationshipSignal.status,
                              }
                            : {}),
                    });
                    onChange(sort);
                }}
            >
                <Row spacing={3}>
                    <AnimateFlyToItem {...animateFlyToShoppingCart.props}>
                        <PlantOrSortImage
                            plantSort={sort}
                            width={48}
                            height={48}
                            className="size-12 shrink-0 min-w-12"
                        />
                    </AnimateFlyToItem>
                    <Stack>
                        <Typography level="body1" semiBold>
                            {sort.information.name}
                        </Typography>
                        <Typography
                            level="body2"
                            className="font-normal line-clamp-2 break-words"
                        >
                            {sort.information.shortDescription ??
                                sort.information.plant.information?.description}
                        </Typography>
                    </Stack>
                </Row>
                {selectedSortId === sort.id && (
                    <span title="Odabrano">
                        <Check aria-hidden className="size-5 shrink-0" />
                    </span>
                )}
            </Button>
            <Row
                justifyContent="space-between"
                className="flex-wrap gap-y-1 px-4"
            >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    {relationshipSignal ? (
                        <PlantRelationshipSignalChips
                            signal={relationshipSignal}
                        />
                    ) : null}
                </div>
                <Button
                    title="Više informacija"
                    href={KnownPages.GredicePlantSort(
                        sort.information.plant.information?.name ?? 'nepoznato',
                        sort.information.name,
                    )}
                    variant="link"
                    size="sm"
                    onClick={() =>
                        track('game_plant_sort_details_opened', {
                            plant_name:
                                sort.information.plant.information?.name,
                            sort_id: sort.id,
                            sort_name: sort.information.name,
                        })
                    }
                >
                    Više informacija...
                </Button>
            </Row>
        </Stack>
    );
}

export function PlantsSortList({
    plantId,
    selectedSortId,
    onChange,
    search,
    flyToShoppingCart,
    neighborPlants = [],
}: PlantsSortListProps) {
    const { data: plantSorts, isLoading, isError } = usePlantSorts(plantId);
    const normalizedSearch = search.trim().toLowerCase();
    const storePlants = plantSorts?.filter(
        (sort) => sort.store.availableInStore,
    );
    const filteredPlantSorts =
        normalizedSearch.length > 0
            ? storePlants?.filter((sort) =>
                  sort.information.name
                      .toLowerCase()
                      .includes(normalizedSearch),
              )
            : storePlants;

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
            <List
                variant="outlined"
                className="max-h-[40dvh] overflow-y-auto bg-card md:max-h-96"
            >
                {!isLoading && filteredPlantSorts?.length === 0 && (
                    <NoDataPlaceholder className="p-4">
                        Nema rezultata
                    </NoDataPlaceholder>
                )}
                {isLoading &&
                    Array.from({ length: 3 }).map((_, index) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: Allowed, skeleton
                        <PlantListItemSkeleton key={index} />
                    ))}
                {filteredPlantSorts?.map((sort) => (
                    <PlantSortListItem
                        key={sort.id}
                        sort={sort}
                        selectedSortId={selectedSortId}
                        onChange={onChange}
                        neighborPlants={neighborPlants}
                        flyToShoppingCart={
                            flyToShoppingCart && selectedSortId === sort.id
                        }
                    />
                ))}
            </List>
        </>
    );
}
