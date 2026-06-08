'use client';

import type { RaisedBedWeedStateLevel } from '@gredice/storage';
import { SelectItems } from '@gredice/ui/SelectItems';
import { setRaisedBedFieldWeedState } from '../../../(actions)/raisedBedFieldsActions';
import {
    isRaisedBedWeedStateLevel,
    RaisedBedWeedStateItems,
} from './RaisedBedWeedStateItems';

export function RaisedBedFieldWeedStateSelector({
    className,
    level,
    positionIndex,
    raisedBedId,
    variant = 'outlined',
}: {
    className?: string;
    level: RaisedBedWeedStateLevel;
    positionIndex: number;
    raisedBedId: number;
    variant?: 'outlined' | 'plain';
}) {
    return (
        <SelectItems
            className={className}
            placeholder={`Korov polje ${positionIndex + 1}`}
            value={level}
            onValueChange={(newValue) => {
                if (
                    !isRaisedBedWeedStateLevel(newValue) ||
                    newValue === level
                ) {
                    return;
                }

                setRaisedBedFieldWeedState({
                    level: newValue,
                    positionIndex,
                    raisedBedId,
                });
            }}
            items={RaisedBedWeedStateItems}
            variant={variant}
        />
    );
}
