'use client';

import type { PlantSortData } from '@gredice/client';
import { SelectItems } from '@signalco/ui-primitives/SelectItems';
import { raisedBedFieldUpdatePlant } from '../../../(actions)/raisedBedFieldsActions';

type RaisedBedFieldPlantSortSelectorProps = {
    raisedBedId: number;
    positionIndex: number;
    status: string | null;
    plantSortId?: number | null;
    plantSorts: PlantSortData[];
};

export function RaisedBedFieldPlantSortSelector({
    raisedBedId,
    positionIndex,
    status,
    plantSortId,
    plantSorts,
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
        if (!newValue) {
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
        });
    };

    return (
        <SelectItems
            placeholder={placeholder}
            value={plantSortId ? plantSortId.toString() : ''}
            onValueChange={handleChange}
            items={items}
            disabled={items.length === 0}
        />
    );
}
