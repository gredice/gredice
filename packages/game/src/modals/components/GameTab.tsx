import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { EnvironmentSettingsCard } from './EnvironmentSettingsCard';
import { QualitySettingsCard } from './QualitySettingsCard';

export function GameTab() {
    return (
        <Stack spacing={4}>
            <Typography level="h4" className="hidden md:block">
                🎮 Igra
            </Typography>
            <Stack spacing={1}>
                <QualitySettingsCard />
                <EnvironmentSettingsCard />
            </Stack>
        </Stack>
    );
}
