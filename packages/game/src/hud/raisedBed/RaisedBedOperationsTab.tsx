import type { OperationData } from '@gredice/client';
import { useCallback } from 'react';
import { OperationsList } from './shared/OperationsList';

function filterRaisedBedOperations(operation: OperationData) {
    return (
        operation.attributes.application === 'raisedBedFull' ||
        operation.attributes.application === 'raisedBed1m'
    );
}

export function RaisedBedOperationsTab({
    gardenId,
    raisedBedId,
}: {
    gardenId: number;
    raisedBedId?: number;
}) {
    const filterFunc = useCallback(filterRaisedBedOperations, []);

    return (
        <OperationsList
            gardenId={gardenId}
            raisedBedId={raisedBedId}
            filterFunc={filterFunc}
        />
    );
}
