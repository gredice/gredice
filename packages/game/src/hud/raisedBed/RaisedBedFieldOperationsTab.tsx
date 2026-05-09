import type { OperationData } from '@gredice/client';
import { useCallback } from 'react';
import { OperationsList } from './shared/OperationsList';

function filterPlantOperations(operation: OperationData) {
    return operation.attributes.application === 'plant';
}

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
    const filterFunc = useCallback(filterPlantOperations, []);

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
