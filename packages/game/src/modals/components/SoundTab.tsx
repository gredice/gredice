import { GameSpeakerIcon } from '@gredice/ui/GameIcons';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { HapticSettingsCard } from './HapticSettingsCard';
import { SoundSettingsCard } from './SoundSettingsCard';

export function SoundTab() {
    return (
        <Stack spacing={8}>
            <Typography
                level="h4"
                className="hidden md:flex items-center gap-2"
            >
                <GameSpeakerIcon aria-hidden className="size-8 shrink-0" />
                Zvuk
            </Typography>
            <SoundSettingsCard />
            <HapticSettingsCard />
        </Stack>
    );
}
