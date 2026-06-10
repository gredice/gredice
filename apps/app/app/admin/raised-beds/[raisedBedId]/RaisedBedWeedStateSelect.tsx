'use client';

import type { RaisedBedWeedStateLevel } from '@gredice/storage';
import { SelectItems } from '@gredice/ui/SelectItems';
import { setRaisedBedWeedState } from '../../../(actions)/raisedBedActions';
import {
    isRaisedBedWeedStateLevel,
    RaisedBedWeedStateItems,
} from './RaisedBedWeedStateItems';

export function RaisedBedWeedStateSelect({
    raisedBedId,
    level,
}: {
    raisedBedId: number;
    level: RaisedBedWeedStateLevel;
}) {
    return (
        <SelectItems
            label="Korov"
            value={level}
            onValueChange={(newValue) => {
                if (
                    !isRaisedBedWeedStateLevel(newValue) ||
                    newValue === level
                ) {
                    return;
                }

                setRaisedBedWeedState(raisedBedId, newValue);
            }}
            items={RaisedBedWeedStateItems}
        />
    );
}
