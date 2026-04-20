import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { DayNightCycleSettingsCard } from './DayNightCycleSettingsCard';
import { TimeZoneSettingsCard } from './TimeZoneSettingsCard';
import { UserBirthdayCard } from './UserBirthdayCard';
import { UserProfileCard } from './UserProfileCard';

export function GeneralTab() {
    return (
        <Stack spacing={4}>
            <Typography level="h4" className="hidden md:block">
                ⚙️ Profil
            </Typography>
            <Stack spacing={1}>
                <DayNightCycleSettingsCard />
                <UserProfileCard />
                <UserBirthdayCard />
                <TimeZoneSettingsCard />
            </Stack>
        </Stack>
    );
}
