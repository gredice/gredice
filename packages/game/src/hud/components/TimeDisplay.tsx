'use client';

import { Divider } from '@gredice/ui/Divider';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useCallback } from 'react';
import { useGameFlags } from '../../GameFlagsContext';
import { useLiveTime } from '../../hooks/useLiveTime';
import { useGameState } from '../../useGameState';
import { createDateForGameTimeOfDay } from '../../utils/timeOfDay';
import { TimeOfDayVisualization } from './TimeOfDayVisualization';

export function TimeDisplay() {
    const { enableDebugHudFlag = false } = useGameFlags();
    const currentTime = useLiveTime();
    const timeOfDay = useGameState((state) => state.timeOfDay);
    const sunrise = useGameState((state) => state.sunriseTime);
    const sunset = useGameState((state) => state.sunsetTime);
    const setFreezeTime = useGameState((state) => state.setFreezeTime);
    const setDayNightCycleDisabled = useGameState(
        (state) => state.setDayNightCycleDisabled,
    );

    const isDaytime = timeOfDay >= 0.2 && timeOfDay <= 0.8;
    const updateTimeOfDay = useCallback(
        (nextTimeOfDay: number) => {
            setDayNightCycleDisabled(false);
            setFreezeTime(
                createDateForGameTimeOfDay(currentTime, nextTimeOfDay),
            );
        },
        [currentTime, setDayNightCycleDisabled, setFreezeTime],
    );

    return (
        <Stack className="w-[22rem] max-w-[calc(100vw-1rem)]">
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
                <TimeOfDayVisualization
                    className="mb-2"
                    interactive={enableDebugHudFlag}
                    onChange={updateTimeOfDay}
                    timeOfDay={timeOfDay}
                />
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
                    {currentTime.toLocaleDateString('hr-HR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                    })}
                </Typography>
            </Stack>
        </Stack>
    );
}
