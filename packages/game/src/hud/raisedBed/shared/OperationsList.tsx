import type { OperationData } from '@gredice/client';
import { Alert } from '@signalco/ui/Alert';
import { NoDataPlaceholder } from '@signalco/ui/NoDataPlaceholder';
import { Close, Search } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { List } from '@signalco/ui-primitives/List';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { memo, useMemo, useState } from 'react';
import { useOperations } from '../../../hooks/useOperations';
import { usePlantSort } from '../../../hooks/usePlantSorts';
import { useShoppingCart } from '../../../hooks/useShoppingCart';
import { useShoppingCartOpenParam } from '../../../useUrlState';
import { OperationListItemSkeleton } from '../OperationListItemSkeleton';
import { OperationsListItem } from './OperationsListItem';

const MemoizedOperationsListItem = memo(OperationsListItem);

const OperationsListContent = memo(function OperationsListContent({
    operations,
    isLoading,
    search,
    gardenId,
    raisedBedId,
    positionIndex,
    shoppingCartOperationIds,
}: {
    operations: OperationData[] | undefined;
    isLoading: boolean;
    search: string;
    gardenId: number;
    raisedBedId?: number;
    positionIndex?: number;
    shoppingCartOperationIds: Set<number>;
}) {
    return (
        <List variant="outlined" className="bg-card max-h-96 overflow-y-auto">
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
                    inShoppingCart={shoppingCartOperationIds.has(operation.id)}
                    key={operation.id}
                    operation={operation}
                    gardenId={gardenId}
                    raisedBedId={raisedBedId}
                    positionIndex={positionIndex}
                />
            ))}
        </List>
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
    const { data: cart } = useShoppingCart();
    const [, setShoppingCartOpen] = useShoppingCartOpenParam();
    const isLoading =
        isLoadingOperations || (Boolean(plantSortId) && isPlantSortLoading);
    const [search, setSearch] = useState('');

    const shoppingCartOperationIds = useMemo(
        () =>
            new Set(
                (cart?.items ?? [])
                    .filter((item) => item.entityTypeName === 'operation')
                    .map((item) => Number(item.entityId)),
            ),
        [cart?.items],
    );

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
    const sortedOperations = [...cartOperations, ...remainingOperations];

    return (
        <Stack spacing={1}>
            <Row className="relative">
                <Search className="size-5 shrink-0 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Pretraži..."
                    className="w-full min-w-60 pl-10 pr-10 py-2 rounded-md border border-input bg-muted/50 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
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
            {cartOperations.length > 0 && (
                <Row
                    justifyContent="space-between"
                    alignItems="center"
                    className="px-1"
                >
                    <Alert color="warning" className="py-1">
                        Radnje u košarici (nisu kupljene) su na vrhu popisa.
                    </Alert>
                    <Button
                        size="sm"
                        variant="link"
                        onClick={() => setShoppingCartOpen(true)}
                    >
                        Otvori košaricu
                    </Button>
                </Row>
            )}
            <OperationsListContent
                operations={sortedOperations}
                isLoading={isLoading}
                search={search}
                gardenId={gardenId}
                raisedBedId={raisedBedId}
                positionIndex={positionIndex}
                shoppingCartOperationIds={shoppingCartOperationIds}
            />
        </Stack>
    );
}
