import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { HapticSettingsCard } from './HapticSettingsCard';
import { SoundSettingsCard } from './SoundSettingsCard';

export function SoundTab() {
    return (
        <Stack spacing={4}>
            <Typography level="h4" className="hidden md:block">
                🔊 Zvuk
            </Typography>
            <SoundSettingsCard />
            <HapticSettingsCard />
        </Stack>
    );
}
