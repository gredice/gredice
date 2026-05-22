import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { HapticSettingsCard } from './HapticSettingsCard';
import { SoundSettingsCard } from './SoundSettingsCard';

export function SoundTab() {
    return (
        <Stack spacing={8}>
            <Typography level="h4" className="hidden md:block">
                🔊 Zvuk
            </Typography>
            <SoundSettingsCard />
            <HapticSettingsCard />
        </Stack>
    );
}
