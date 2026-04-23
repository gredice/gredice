import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { EnvironmentSettingsCard } from './EnvironmentSettingsCard';

export function GameTab() {
    return (
        <Stack spacing={4}>
            <Typography level="h4" className="hidden md:block">
                🎮 Igra
            </Typography>
            <Stack spacing={1}>
                <EnvironmentSettingsCard />
            </Stack>
        </Stack>
    );
}
