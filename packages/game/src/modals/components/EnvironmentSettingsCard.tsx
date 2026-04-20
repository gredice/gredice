import { Card, CardContent } from '@signalco/ui-primitives/Card';
import { Checkbox } from '@signalco/ui-primitives/Checkbox';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useGameState } from '../../useGameState';

export function EnvironmentSettingsCard() {
    const dayNightCycleDisabled = useGameState(
        (state) => state.dayNightCycleDisabled,
    );
    const setDayNightCycleDisabled = useGameState(
        (state) => state.setDayNightCycleDisabled,
    );
    const weatherVisualizationDisabled = useGameState(
        (state) => state.weatherVisualizationDisabled,
    );
    const setWeatherVisualizationDisabled = useGameState(
        (state) => state.setWeatherVisualizationDisabled,
    );

    return (
        <Card>
            <CardContent noHeader>
                <Stack spacing={2}>
                    <Stack spacing={1.5}>
                        <Checkbox
                            label="Uvijek dan"
                            checked={dayNightCycleDisabled}
                            onCheckedChange={(checked: boolean) =>
                                setDayNightCycleDisabled(checked)
                            }
                        />
                        <Typography level="body3" secondary>
                            Isključi izmjenu dana i noći za stalni dnevni prikaz
                            vrta.
                        </Typography>
                    </Stack>
                    <Stack spacing={1.5}>
                        <Checkbox
                            label="Uvijek sunčano"
                            checked={weatherVisualizationDisabled}
                            onCheckedChange={(checked: boolean) =>
                                setWeatherVisualizationDisabled(checked)
                            }
                        />
                        <Typography level="body3" secondary>
                            Isključi prikaz vremena za stalno sunčani prikaz
                            vrta.
                        </Typography>
                    </Stack>
                </Stack>
            </CardContent>
        </Card>
    );
}
