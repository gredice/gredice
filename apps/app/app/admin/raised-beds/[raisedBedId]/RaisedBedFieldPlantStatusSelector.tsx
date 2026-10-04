'use client';

import { SelectItems } from '@gredice/ui/SelectItems';
import { useRouter } from 'next/navigation';
import { raisedBedFieldPlantStatusItems } from '../../../../src/raisedBedFieldPlantStatusItems';

import { raisedBedFieldUpdatePlant } from '../../../(actions)/raisedBedFieldsActions';
import { canUpdatePlantingTaskStatus } from '../../schedule/scheduleShared';

export { raisedBedFieldPlantStatusItems } from '../../../../src/raisedBedFieldPlantStatusItems';

export const dynamic = 'force-dynamic';

export function RaisedBedFieldPlantStatusSelector({
    raisedBedId,
    positionIndex,
    status,
    expectedPlantCycleEventId,
    expectedPlantCycleVersionEventId,
    expectedPlantSortId,
    variant = 'outlined',
    className,
}: {
    raisedBedId: number;
    positionIndex: number;
    status: string;
    expectedPlantCycleEventId: number;
    expectedPlantCycleVersionEventId: number;
    expectedPlantSortId: number;
    variant?: 'outlined' | 'plain';
    className?: string;
}) {
    const router = useRouter();

    return (
        <SelectItems
            value={status}
            variant={variant}
            className={className}
            onValueChange={async (newValue) => {
                await raisedBedFieldUpdatePlant({
                    raisedBedId,
                    positionIndex,
                    status: newValue,
                    expectedPlantCycleEventId,
                    expectedPlantCycleVersionEventId,
                    expectedPlantSortId,
                    expectedPlantStatus: status,
                });
                router.refresh();
            }}
            items={raisedBedFieldPlantStatusItems.filter((item) =>
                canUpdatePlantingTaskStatus(status, item.value),
            )}
        />
    );
}
