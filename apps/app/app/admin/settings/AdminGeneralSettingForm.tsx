'use client';

import { Button } from '@gredice/ui/Button';
import { SelectItems } from '@gredice/ui/SelectItems';
import { getTimeZones } from '@vvo/tzdb';
import { useActionState, useEffect, useMemo, useState } from 'react';
import { updateAdminGeneralSettingsAction } from '../../(actions)/adminGeneralSettingsActions';
import { SettingsCardBody } from './_components/SettingsCardBody';
import { SettingsCardFooter } from './_components/SettingsCardFooter';
import { SettingsFormMessage } from './_components/SettingsFormMessage';

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
        <form action={formAction}>
            <SettingsCardBody>
                <div className="max-w-xl">
                    <SelectItems
                        name="timeZone"
                        label="Vremenska zona backofficea"
                        value={timeZone}
                        onValueChange={setTimeZone}
                        items={timeZoneOptions}
                        disabled={isPending}
                    />
                </div>
            </SettingsCardBody>
            <SettingsCardFooter>
                <SettingsFormMessage state={state} />
                <Button type="submit" disabled={isPending} variant="solid">
                    {isPending ? 'Spremanje…' : 'Spremi opće postavke'}
                </Button>
            </SettingsCardFooter>
        </form>
    );
}
