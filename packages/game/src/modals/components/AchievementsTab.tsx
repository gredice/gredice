import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { AchievementsOverview } from '../../shared-ui/achievements/AchievementsOverview';

export function AchievementsTab() {
    return (
        <Stack spacing={8}>
            <Typography level="h4" className="hidden md:block">
                🏆 Postignuća
            </Typography>
            <AchievementsOverview />
        </Stack>
    );
}
