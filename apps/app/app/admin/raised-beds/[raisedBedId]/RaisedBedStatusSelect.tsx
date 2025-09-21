'use client';

import { SelectItems } from '@signalco/ui-primitives/SelectItems';
import { useMemo } from 'react';
import { setRaisedBedStatus } from '../../../(actions)/raisedBedActions';

type RaisedBedStatusValue = Parameters<typeof setRaisedBedStatus>[1];

const STATUS_ITEMS: Array<{
    value: RaisedBedStatusValue;
    label: string;
    icon: string;
}> = [
    { value: 'new', label: 'Nova', icon: '🆕' },
    { value: 'approved', label: 'Odobrena', icon: '✅' },
    { value: 'built', label: 'Izgrađena', icon: '🏗️' },
    { value: 'active', label: 'Aktivna', icon: '🌿' },
];

function isRaisedBedStatus(value: string): value is RaisedBedStatusValue {
    return STATUS_ITEMS.some((item) => item.value === value);
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
            return STATUS_ITEMS;
        }

        return [
            {
                value: status,
                label: status,
                icon: 'ℹ️',
            },
            ...STATUS_ITEMS,
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
