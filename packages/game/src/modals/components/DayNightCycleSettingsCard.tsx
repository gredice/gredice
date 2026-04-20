import { Card, CardContent } from '@signalco/ui-primitives/Card';
import { Checkbox } from '@signalco/ui-primitives/Checkbox';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useGameState } from '../../useGameState';

export function DayNightCycleSettingsCard() {
    const dayNightCycleDisabled = useGameState(
        (state) => state.dayNightCycleDisabled,
    );
    const setDayNightCycleDisabled = useGameState(
        (state) => state.setDayNightCycleDisabled,
    );

    return (
        <Card>
            <CardContent noHeader>
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
            </CardContent>
        </Card>
    );
}
