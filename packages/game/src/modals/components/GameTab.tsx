import { GameControllerIcon } from '@gredice/ui/GameIcons';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { EnvironmentSettingsCard } from './EnvironmentSettingsCard';
import { QualitySettingsCard } from './QualitySettingsCard';

export function GameTab() {
    return (
        <Stack spacing={8}>
            <Typography
                level="h4"
                className="hidden md:flex items-center gap-2"
            >
                <GameControllerIcon aria-hidden className="size-8 shrink-0" />
                Igra
            </Typography>
            <Stack spacing={2}>
                <QualitySettingsCard />
                <EnvironmentSettingsCard />
            </Stack>
        </Stack>
    );
}
