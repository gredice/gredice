import { Card, CardContent } from '@gredice/ui/Card';
import { Checkbox } from '@gredice/ui/Checkbox';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
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
                <Stack spacing={4}>
                    <Stack spacing={3}>
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
                    <Stack spacing={3}>
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
