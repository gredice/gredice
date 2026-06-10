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
import { useEffect, useMemo } from 'react';
import { useGameAnalytics } from '../../analytics/GameAnalyticsContext';
import { sortFavoritesFirst, useFavoriteIds } from '../../hooks/useFavorites';
import type { OutletOfferData } from '../../hooks/useOutletOffers';
import { usePlantSorts } from '../../hooks/usePlantSorts';
import {
    AnimateFlyToItem,
    useAnimateFlyToShoppingCart,
} from '../../indicators/AnimateFlyTo';
import { KnownPages } from '../../knownPages';
import { FavoriteToggleButton } from './FavoriteToggleButton';
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
    outletOffersBySortId?: Map<number, OutletOfferData[]>;
};

const currencyFormatter = new Intl.NumberFormat('hr-HR', {
    style: 'currency',
    currency: 'EUR',
});

function outletOfferBadgeLabel(outletOffers: OutletOfferData[]) {
    if (outletOffers.length === 1) {
        return `Outlet ${currencyFormatter.format(outletOffers[0].outletPrice)}`;
    }

    return `Outlet ${outletOffers.length} ponude`;
}

function PlantSortListItem({
    sort,
    selectedSortId,
    onChange,
    flyToShoppingCart,
    neighborPlants,
    outletOffers,
}: {
    sort: PlantSortData;
    selectedSortId: number | null;
    onChange: (sort: PlantSortData) => void;
    flyToShoppingCart?: boolean;
    neighborPlants: NeighborPlantSummary[];
    outletOffers?: OutletOfferData[];
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
        <Stack
            className={cx(selectedSortId === sort.id && 'bg-muted')}
            data-plant-picker-sort-id={sort.id}
        >
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
                    {outletOffers?.length ? (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-900/50 dark:text-green-200">
                            {outletOfferBadgeLabel(outletOffers)}
                        </span>
                    ) : null}
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
                <FavoriteToggleButton
                    entityId={sort.id}
                    entityType="plantSort"
                    label={sort.information.name}
                />
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
    outletOffersBySortId,
}: PlantsSortListProps) {
    const { data: plantSorts, isLoading, isError } = usePlantSorts(plantId);
    const favoriteSortIds = useFavoriteIds('plantSort');
    const normalizedSearch = search.trim().toLowerCase();
    const sortedPlantSorts = useMemo(() => {
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

        return filteredPlantSorts
            ? sortFavoritesFirst(filteredPlantSorts, favoriteSortIds)
            : undefined;
    }, [favoriteSortIds, normalizedSearch, plantSorts]);

    // Select first sort if only one is available
    useEffect(() => {
        if (sortedPlantSorts?.length === 1 && !selectedSortId) {
            onChange(sortedPlantSorts[0]);
        }
    }, [sortedPlantSorts, selectedSortId, onChange]);

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
                {!isLoading && sortedPlantSorts?.length === 0 && (
                    <NoDataPlaceholder className="p-4">
                        Nema rezultata
                    </NoDataPlaceholder>
                )}
                {isLoading &&
                    Array.from({ length: 3 }).map((_, index) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: Allowed, skeleton
                        <PlantListItemSkeleton key={index} />
                    ))}
                {sortedPlantSorts?.map((sort) => (
                    <PlantSortListItem
                        key={sort.id}
                        sort={sort}
                        selectedSortId={selectedSortId}
                        onChange={onChange}
                        neighborPlants={neighborPlants}
                        outletOffers={outletOffersBySortId?.get(sort.id)}
                        flyToShoppingCart={
                            flyToShoppingCart && selectedSortId === sort.id
                        }
                    />
                ))}
            </List>
        </>
    );
}
