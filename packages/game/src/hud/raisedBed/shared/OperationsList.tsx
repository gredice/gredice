import type { OperationData } from '@gredice/client';
import { Alert } from '@gredice/ui/Alert';
import { IconButton } from '@gredice/ui/IconButton';
import { Close, Search } from '@gredice/ui/icons';
import { List } from '@gredice/ui/List';
import { NoDataPlaceholder } from '@gredice/ui/NoDataPlaceholder';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { memo, useState } from 'react';
import {
    sortFavoritesFirst,
    useFavoriteIds,
} from '../../../hooks/useFavorites';
import { useOperations } from '../../../hooks/useOperations';
import { usePlantSort } from '../../../hooks/usePlantSorts';
import { ScrollView } from '../../../shared-ui/ScrollView';
import { OperationListItemSkeleton } from '../OperationListItemSkeleton';
import { OperationsListItem } from './OperationsListItem';
import { useOperationContextIndicators } from './useOperationContextIndicators';

const MemoizedOperationsListItem = memo(OperationsListItem);

const OperationsListContent = memo(function OperationsListContent({
    operations,
    isLoading,
    search,
    gardenId,
    raisedBedId,
    positionIndex,
    shoppingCartOperationIds,
    scheduledOperationIds,
}: {
    operations: OperationData[] | undefined;
    isLoading: boolean;
    search: string;
    gardenId: number;
    raisedBedId?: number;
    positionIndex?: number;
    shoppingCartOperationIds: Set<number>;
    scheduledOperationIds: Set<number>;
}) {
    return (
        <ScrollView
            className="overflow-hidden rounded-lg border bg-card"
            viewportClassName="max-h-96"
            topFadeClassName="from-card"
            bottomFadeClassName="from-card"
        >
            <List className="divide-y">
                {!isLoading && operations?.length === 0 && (
                    <NoDataPlaceholder className="p-4">
                        {search.length > 0
                            ? 'Nema rezultata pretrage'
                            : 'Nema dostupnih radnji'}
                    </NoDataPlaceholder>
                )}
                {isLoading &&
                    Array.from({ length: 3 }).map((_, index) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: Array indexed, skeletons
                        <OperationListItemSkeleton key={index} />
                    ))}
                {operations?.map((operation) => (
                    <MemoizedOperationsListItem
                        inShoppingCart={shoppingCartOperationIds.has(
                            operation.id,
                        )}
                        isScheduled={scheduledOperationIds.has(operation.id)}
                        key={operation.id}
                        operation={operation}
                        gardenId={gardenId}
                        raisedBedId={raisedBedId}
                        positionIndex={positionIndex}
                    />
                ))}
            </List>
        </ScrollView>
    );
});

export function OperationsList({
    gardenId,
    raisedBedId,
    positionIndex,
    plantSortId,
    filterFunc,
}: {
    gardenId: number;
    raisedBedId?: number;
    positionIndex?: number;
    plantSortId?: number;
    filterFunc: (operation: OperationData) => boolean;
}) {
    const {
        data: operations,
        isLoading: isLoadingOperations,
        isError,
    } = useOperations();
    const { data: plantSort, isLoading: isPlantSortLoading } =
        usePlantSort(plantSortId);
    const favoriteOperationIds = useFavoriteIds('operation');
    const isLoading =
        isLoadingOperations || (Boolean(plantSortId) && isPlantSortLoading);
    const [search, setSearch] = useState('');

    const { shoppingCartOperationIds, scheduledOperationIds } =
        useOperationContextIndicators({
            gardenId,
            raisedBedId,
            positionIndex,
        });

    const filteredOperations = operations
        ?.filter(filterFunc)
        .filter((op) =>
            plantSortId
                ? plantSort?.information.plant.information?.operations
                      ?.map((op) => op.information?.name)
                      .includes(op.information.name)
                : true,
        )
        .filter((op) =>
            search.length > 0
                ? op.information.label
                      ?.toLowerCase()
                      .includes(search.toLowerCase()) ||
                  op.information.name
                      ?.toLowerCase()
                      .includes(search.toLowerCase())
                : true,
        );

    const cartOperations =
        filteredOperations?.filter((op) =>
            shoppingCartOperationIds.has(op.id),
        ) ?? [];
    const remainingOperations =
        filteredOperations?.filter(
            (op) => !shoppingCartOperationIds.has(op.id),
        ) ?? [];
    const sortedOperations = [
        ...sortFavoritesFirst(cartOperations, favoriteOperationIds),
        ...sortFavoritesFirst(remainingOperations, favoriteOperationIds),
    ];

    return (
        <Stack spacing={2}>
            <Row className="relative">
                <Search className="size-5 shrink-0 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Pretraži..."
                    className="w-full min-w-60 pl-10 pr-10 py-2 rounded-md border border-input bg-muted/50 text-sm placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-ring"
                />
                {search && (
                    <IconButton
                        className="absolute right-1 top-1/2 -translate-y-1/2 hover:bg-neutral-300 rounded-full"
                        title="Očisti pretragu"
                        onClick={() => setSearch('')}
                        size="sm"
                        variant="plain"
                    >
                        <Close className="size-5" />
                    </IconButton>
                )}
            </Row>
            {isError && (
                <Alert color="danger">Greška prilikom učitavanja radnji</Alert>
            )}
            <OperationsListContent
                operations={sortedOperations}
                isLoading={isLoading}
                search={search}
                gardenId={gardenId}
                raisedBedId={raisedBedId}
                positionIndex={positionIndex}
                shoppingCartOperationIds={shoppingCartOperationIds}
                scheduledOperationIds={scheduledOperationIds}
            />
        </Stack>
    );
}
