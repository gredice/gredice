import type { OperationData } from '@gredice/client';
import { Alert } from '@signalco/ui/Alert';
import { NoDataPlaceholder } from '@signalco/ui/NoDataPlaceholder';
import { List } from '@signalco/ui-primitives/List';
import { useOperations } from '../../../hooks/useOperations';
import { usePlantSort } from '../../../hooks/usePlantSorts';
import { OperationListItemSkeleton } from '../OperationListItemSkeleton';
import { OperationsListItem } from './OperationsListItem';

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
    const isLoading =
        isLoadingOperations || (Boolean(plantSortId) && isPlantSortLoading);
    const filteredOperations = operations
        ?.filter(filterFunc)
        .filter((op) =>
            plantSortId
                ? plantSort?.information.plant.information?.operations
                      ?.map((op) => op.information?.name)
                      .includes(op.information.name)
                : true,
        );

    return (
        <>
            {isError && (
                <Alert color="danger">Greška prilikom učitavanja radnji</Alert>
            )}
            <List
                variant="outlined"
                className="bg-card max-h-96 overflow-y-auto"
            >
                {!isLoading && filteredOperations?.length === 0 && (
                    <NoDataPlaceholder className="p-4">
                        Nema dostupnih radnji
                    </NoDataPlaceholder>
                )}
                {isLoading &&
                    Array.from({ length: 3 }).map((_, index) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: Array indexed, skeletons
                        <OperationListItemSkeleton key={index} />
                    ))}
                {filteredOperations?.map((operation) => (
                    <OperationsListItem
                        key={operation.id}
                        operation={operation}
                        gardenId={gardenId}
                        raisedBedId={raisedBedId}
                        positionIndex={positionIndex}
                    />
                ))}
            </List>
        </>
    );
}
