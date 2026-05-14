import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { AchievementsOverview } from '../../shared-ui/achievements/AchievementsOverview';

export function AchievementsTab() {
    return (
        <Stack spacing={4}>
            <Typography level="h4" className="hidden md:block">
                🏆 Postignuća
            </Typography>
            <AchievementsOverview />
        </Stack>
    );
}
