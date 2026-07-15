'use client';

import type { PlantSortData } from '@gredice/client';
import { SelectItems } from '@gredice/ui/SelectItems';
import { raisedBedFieldUpdatePlant } from '../../../(actions)/raisedBedFieldsActions';
import { canSwitchPlantingTaskSort } from '../../schedule/scheduleShared';

type RaisedBedFieldPlantSortSelectorProps = {
    raisedBedId: number;
    positionIndex: number;
    status: string | null;
    plantSortId?: number | null;
    expectedPlantCycleEventId?: number;
    expectedPlantCycleVersionEventId?: number;
    plantSorts: PlantSortData[];
    variant?: 'outlined' | 'plain';
    className?: string;
};

export function RaisedBedFieldPlantSortSelector({
    raisedBedId,
    positionIndex,
    status,
    plantSortId,
    expectedPlantCycleEventId,
    expectedPlantCycleVersionEventId,
    plantSorts,
    variant = 'outlined',
    className,
}: RaisedBedFieldPlantSortSelectorProps) {
    const items = plantSorts
        .map((sort) => ({
            value: sort.id.toString(),
            label: sort.information?.name ?? `Sorta biljke ${sort.id}`,
        }))
        .sort((a, b) => a.label.localeCompare(b.label));

    if (
        plantSortId &&
        !items.some((item) => item.value === plantSortId.toString())
    ) {
        items.push({
            value: plantSortId.toString(),
            label: `Sorta biljke ${plantSortId}`,
        });
    }

    const placeholder =
        items.length === 0 ? 'Nema dostupnih biljaka' : 'Odaberi biljku';

    const handleChange = (newValue: string) => {
        if (
            !newValue ||
            !plantSortId ||
            !expectedPlantCycleEventId ||
            !expectedPlantCycleVersionEventId
        ) {
            return;
        }

        const nextPlantSortId = Number.parseInt(newValue, 10);
        if (Number.isNaN(nextPlantSortId) || nextPlantSortId === plantSortId) {
            return;
        }

        raisedBedFieldUpdatePlant({
            raisedBedId,
            positionIndex,
            status: status ?? undefined,
            plantSortId: nextPlantSortId,
            expectedPlantCycleEventId,
            expectedPlantCycleVersionEventId,
            expectedPlantSortId: plantSortId,
        });
    };

    return (
        <SelectItems
            placeholder={placeholder}
            value={plantSortId ? plantSortId.toString() : ''}
            onValueChange={handleChange}
            items={items}
            disabled={
                items.length === 0 ||
                !plantSortId ||
                !expectedPlantCycleEventId ||
                !expectedPlantCycleVersionEventId ||
                !canSwitchPlantingTaskSort(status)
            }
            variant={variant}
            className={className}
        />
    );
}
