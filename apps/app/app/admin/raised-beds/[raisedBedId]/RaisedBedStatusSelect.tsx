'use client';

import { SelectItems } from '@signalco/ui-primitives/SelectItems';
import { useMemo } from 'react';
import { setRaisedBedStatus } from '../../../(actions)/raisedBedActions';
import {
    RaisedBedStatusItems,
    type RaisedBedStatusValue,
} from './RaisedBedStatusItems';

function isRaisedBedStatus(value: string): value is RaisedBedStatusValue {
    return RaisedBedStatusItems.some((item) => item.value === value);
}

export function RaisedBedStatusSelect({
    raisedBedId,
    status,
}: {
    raisedBedId: number;
    status: string;
}) {
    const items = useMemo(() => {
        if (isRaisedBedStatus(status)) {
            return RaisedBedStatusItems;
        }

        return [
            {
                value: status,
                label: status,
                icon: 'ℹ️',
            },
            ...RaisedBedStatusItems,
        ];
    }, [status]);

    return (
        <SelectItems
            label="Status"
            value={status}
            onValueChange={(newValue) => {
                if (!isRaisedBedStatus(newValue) || newValue === status) {
                    return;
                }

                setRaisedBedStatus(raisedBedId, newValue);
            }}
            items={items}
        />
    );
}
