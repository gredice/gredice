import { GameTrophyIcon } from '@gredice/ui/GameIcons';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { AchievementsOverview } from '../../shared-ui/achievements/AchievementsOverview';

export function AchievementsTab() {
    return (
        <Stack spacing={8}>
            <Typography
                level="h4"
                className="hidden md:flex items-center gap-2"
            >
                <GameTrophyIcon aria-hidden className="size-8 shrink-0" />
                Postignuća
            </Typography>
            <AchievementsOverview />
        </Stack>
    );
}
