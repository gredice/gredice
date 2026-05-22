'use client';

import { Button } from '@gredice/ui/Button';
import { SelectItems } from '@gredice/ui/SelectItems';
import { Stack } from '@gredice/ui/Stack';
import { getTimeZones } from '@vvo/tzdb';
import { useActionState, useEffect, useMemo, useState } from 'react';
import { updateAdminGeneralSettingsAction } from '../../(actions)/adminGeneralSettingsActions';

const timeZones = getTimeZones();

type AdminGeneralSettingFormProps = {
    initialTimeZone: string;
};

export function AdminGeneralSettingForm({
    initialTimeZone,
}: AdminGeneralSettingFormProps) {
    const [timeZone, setTimeZone] = useState(initialTimeZone);
    const [state, formAction, isPending] = useActionState(
        updateAdminGeneralSettingsAction,
        null,
    );

    const timeZoneOptions = useMemo(
        () =>
            timeZones.map((tz) => ({
                value: tz.name,
                label: `${tz.currentTimeFormat} (${tz.name})`,
            })),
        [],
    );

    useEffect(() => {
        if (state?.success) {
            setTimeZone((value) => value.trim());
        }
    }, [state]);

    return (
        <form action={formAction} className="space-y-3">
            <Stack spacing={2}>
                <SelectItems
                    name="timeZone"
                    label="Vremenska zona backofficea"
                    value={timeZone}
                    onValueChange={setTimeZone}
                    items={timeZoneOptions}
                    disabled={isPending}
                />
                <p className="text-sm text-muted-foreground">
                    Koristi se kao zadana vremenska zona za administrativne
                    procese i integracije.
                </p>
            </Stack>
            <Button type="submit" disabled={isPending} variant="solid">
                {isPending ? 'Spremanje…' : 'Spremi opće postavke'}
            </Button>
            {state && (
                <p
                    className={`text-sm ${
                        state.success ? 'text-green-600' : 'text-red-600'
                    }`}
                >
                    {state.message}
                </p>
            )}
        </form>
    );
}
