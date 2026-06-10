import { useMemo } from 'react';
import {
    type AppliedOperationVisualInput,
    resolveOperationVisualRewards,
} from '../operationVisualRewards';
import type { useCurrentGarden } from './useCurrentGarden';
import { useGardenOperations } from './useGardenOperations';
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
    const history = useGardenOperations({
        enabled: Boolean(raisedBed),
        includeCompleted: true,
        pageSize: 20,
        raisedBedId: raisedBed?.id,
    });

    return useMemo(() => {
        if (!raisedBed || !operations) {
            return [];
        }

        return resolveOperationVisualRewards({
            appliedOperations: raisedBedAppliedOperationVisualInputs(raisedBed),
            operationItems:
                history.data?.pages.flatMap((page) => page.items) ?? [],
            operations,
        });
    }, [history.data?.pages, operations, raisedBed]);
}
