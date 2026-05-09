'use client';

import { SelectItems } from '@signalco/ui-primitives/SelectItems';
import { getTimeZones } from '@vvo/tzdb';
import { useMemo, useTransition } from 'react';
import { updateAccountTimeZoneAction } from '../../../(actions)/accountTimeZoneActions';

const timeZones = getTimeZones();

interface AccountTimeZonePickerProps {
    accountId: string;
    currentTimeZone: string;
}

export function AccountTimeZonePicker({
    accountId,
    currentTimeZone,
}: AccountTimeZonePickerProps) {
    const [isPending, startTransition] = useTransition();

    const timeZoneOptions = useMemo(
        () =>
            timeZones.map((tz) => ({
                value: tz.name,
                label: `${tz.currentTimeFormat} (${tz.name})`,
            })),
        [],
    );

    const handleTimeZoneChange = (value: string) => {
        startTransition(async () => {
            await updateAccountTimeZoneAction(accountId, value);
        });
    };

    return (
        <SelectItems
            label="Vremenska zona"
            value={currentTimeZone}
            onValueChange={handleTimeZoneChange}
            items={timeZoneOptions}
            disabled={isPending}
        />
    );
}
