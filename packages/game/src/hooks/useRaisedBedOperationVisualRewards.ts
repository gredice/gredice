import { useMemo } from 'react';
import {
    type AppliedOperationVisualInput,
    resolveOperationVisualRewards,
} from '../operationVisualRewards';
import type { useCurrentGarden } from './useCurrentGarden';
import { useOperations } from './useOperations';

type CurrentGardenData = NonNullable<
    NonNullable<ReturnType<typeof useCurrentGarden>['data']>
>;
type RaisedBedData = CurrentGardenData['raisedBeds'][number];

function raisedBedAppliedOperationVisualInputs(
    raisedBed: RaisedBedData,
): AppliedOperationVisualInput[] {
    return (raisedBed.appliedOperations ?? []).map((operation) => ({
        ...operation,
        raisedBedId: raisedBed.id,
    }));
}

export function useRaisedBedOperationVisualRewards(
    raisedBed: RaisedBedData | null | undefined,
) {
    const { data: operations } = useOperations();

    return useMemo(() => {
        if (!raisedBed || !operations) {
            return [];
        }

        return resolveOperationVisualRewards({
            appliedOperations: raisedBedAppliedOperationVisualInputs(raisedBed),
            operations,
        });
    }, [operations, raisedBed]);
}
