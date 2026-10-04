import type { OperationData } from '@gredice/client';
import { useCallback } from 'react';
import { isFieldOperationAvailable } from './fieldOperationAvailability';
import { OperationsList } from './shared/OperationsList';

export function RaisedBedFieldOperationsTab({
    gardenId,
    raisedBedId,
    positionIndex,
    plantSortId,
}: {
    gardenId: number;
    raisedBedId: number;
    positionIndex: number;
    plantSortId?: number;
}) {
    const filterFunc = useCallback(
        (operation: OperationData) =>
            isFieldOperationAvailable(
                operation,
                typeof plantSortId === 'number',
            ),
        [plantSortId],
    );

    return (
        <OperationsList
            gardenId={gardenId}
            raisedBedId={raisedBedId}
            positionIndex={positionIndex}
            plantSortId={plantSortId}
            filterFunc={filterFunc}
        />
    );
}
