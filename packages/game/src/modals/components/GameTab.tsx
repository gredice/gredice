import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { EnvironmentSettingsCard } from './EnvironmentSettingsCard';
import { QualitySettingsCard } from './QualitySettingsCard';

export function GameTab() {
    return (
        <Stack spacing={8}>
            <Typography level="h4" className="hidden md:block">
                🎮 Igra
            </Typography>
            <Stack spacing={2}>
                <QualitySettingsCard />
                <EnvironmentSettingsCard />
            </Stack>
        </Stack>
    );
}
