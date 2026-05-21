import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
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
                <UserProfileCard />
                <UserBirthdayCard />
                <TimeZoneSettingsCard />
            </Stack>
        </Stack>
    );
}
