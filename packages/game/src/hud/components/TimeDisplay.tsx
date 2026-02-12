'use client';

import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useGameState } from '../../useGameState';

export function TimeDisplay() {
    const currentTime = useGameState((state) => state.currentTime);
    const timeOfDay = useGameState((state) => state.timeOfDay);
    const sunrise = useGameState((state) => state.sunriseTime);
    const sunset = useGameState((state) => state.sunsetTime);

    const isDaytime = timeOfDay > 0.2 && timeOfDay < 0.8;

    return (
        <Stack className="pt-16 pb-2 px-4">
            <Row justifyContent="space-between">
                <Typography level="body3">
                    {(isDaytime ? sunrise : sunset)?.toLocaleTimeString(
                        'hr-HR',
                        { hour: '2-digit', minute: '2-digit' },
                    )}
                </Typography>
                <Typography center className="font-[Arial,sans-serif]">
                    {currentTime?.toLocaleTimeString('hr-HR', {
                        hour: '2-digit',
                        minute: '2-digit',
                    })}
                </Typography>
                <Typography level="body3">
                    {(isDaytime ? sunset : sunrise)?.toLocaleTimeString(
                        'hr-HR',
                        { hour: '2-digit', minute: '2-digit' },
                    )}
                </Typography>
            </Row>
            <Typography level="body2" center>
                {new Date().toLocaleDateString('hr-HR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                })}
            </Typography>
        </Stack>
    );
}
