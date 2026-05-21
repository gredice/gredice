'use client';

import { Divider } from '@gredice/ui/Divider';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useLiveTime } from '../../hooks/useLiveTime';
import { useGameState } from '../../useGameState';
import { DayNightVisualization } from './DayNightVisualization';

export function TimeDisplay() {
    const currentTime = useLiveTime();
    const timeOfDay = useGameState((state) => state.timeOfDay);
    const sunrise = useGameState((state) => state.sunriseTime);
    const sunset = useGameState((state) => state.sunsetTime);

    const isDaytime = timeOfDay > 0.2 && timeOfDay < 0.8;

    return (
        <Stack>
            <Row
                className="bg-background px-4 py-2"
                justifyContent="space-between"
            >
                <Typography level="body2" bold>
                    Doba dana
                </Typography>
            </Row>
            <Divider />
            <Stack className="px-4 py-3">
                <DayNightVisualization className="w-full h-12 overflow-visible mb-2" />
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
        </Stack>
    );
}
