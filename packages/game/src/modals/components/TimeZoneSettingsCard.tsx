'use client';

import { Card, CardContent } from '@signalco/ui-primitives/Card';
import { SelectItems } from '@signalco/ui-primitives/SelectItems';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { getTimeZones } from '@vvo/tzdb';
import { useMemo } from 'react';
import { useGameAnalytics } from '../../analytics/GameAnalyticsContext';
import { useCurrentAccount } from '../../hooks/useCurrentAccount';
import { useUpdateAccountTimeZone } from '../../hooks/useUpdateAccountTimeZone';

const timeZones = getTimeZones();

export function TimeZoneSettingsCard() {
    const { data: currentAccount } = useCurrentAccount();
    const { track } = useGameAnalytics();
    const updateTimeZone = useUpdateAccountTimeZone();

    const timeZoneOptions = useMemo(
        () =>
            timeZones.map((tz) => ({
                value: tz.name,
                label: `${tz.currentTimeFormat} (${tz.name})`,
            })),
        [],
    );

    const handleTimeZoneChange = (value: string) => {
        track('game_account_time_zone_changed', {
            time_zone: value,
        });
        updateTimeZone.mutate(value);
    };

    const currentTimeZone =
        (currentAccount && 'timeZone' in currentAccount
            ? currentAccount.timeZone
            : undefined) ?? 'Europe/Paris';

    return (
        <Card>
            <CardContent noHeader>
                <Stack spacing={2}>
                    <Typography level="body2">
                        Odaberi vremensku zonu za svoj račun. Ovo će utjecati na
                        prikaz vremena.
                    </Typography>
                    <SelectItems
                        label="Vremenska zona"
                        value={currentTimeZone}
                        onValueChange={handleTimeZoneChange}
                        items={timeZoneOptions}
                        disabled={updateTimeZone.isPending}
                    />
                </Stack>
            </CardContent>
        </Card>
    );
}
