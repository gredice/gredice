import { GameSettingsIcon } from '@gredice/ui/GameIcons';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { TimeZoneSettingsCard } from './TimeZoneSettingsCard';
import { UserBirthdayCard } from './UserBirthdayCard';
import { UserProfileCard } from './UserProfileCard';

export function GeneralTab() {
    return (
        <Stack spacing={8}>
            <Typography
                level="h4"
                className="hidden md:flex items-center gap-2"
            >
                <GameSettingsIcon aria-hidden className="size-8 shrink-0" />
                Profil
            </Typography>
            <Stack spacing={2}>
                <UserProfileCard />
                <UserBirthdayCard />
                <TimeZoneSettingsCard />
            </Stack>
        </Stack>
    );
}
