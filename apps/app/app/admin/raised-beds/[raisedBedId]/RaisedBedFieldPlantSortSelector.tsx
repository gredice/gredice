'use client';

import { SelectItems } from '@signalco/ui-primitives/SelectItems';
import { raisedBedFieldUpdatePlant } from '../../../(actions)/raisedBedFieldsActions';
import type { EntityStandardized } from '../../../lib/@types/EntityStandardized';

type RaisedBedFieldPlantSortSelectorProps = {
    raisedBedId: number;
    positionIndex: number;
    status: string | null;
    plantSortId?: number | null;
    plantSorts: EntityStandardized[];
};

export function RaisedBedFieldPlantSortSelector({
    raisedBedId,
    positionIndex,
    status,
    plantSortId,
    plantSorts,
}: RaisedBedFieldPlantSortSelectorProps) {
    const items = plantSorts.map((sort) => ({
        value: sort.id.toString(),
        label:
            sort.information?.label ??
            sort.information?.name ??
            `Biljka ${sort.id}`,
    }));

    if (
        plantSortId &&
        !items.some((item) => item.value === plantSortId.toString())
    ) {
        items.push({
            value: plantSortId.toString(),
            label: `Biljka ${plantSortId}`,
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

        void raisedBedFieldUpdatePlant({
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
