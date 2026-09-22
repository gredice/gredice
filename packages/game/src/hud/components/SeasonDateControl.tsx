'use client';

import { Button } from '@gredice/ui/Button';
import { Slider } from '@gredice/ui/Slider';
import { useGameFlags } from '../../GameFlagsContext';
import { useLiveTime } from '../../hooks/useLiveTime';
import { useSeasonState } from '../../hooks/useSeasonState';
import { getSeasonDebugMilestones } from '../../scene/seasonDebugMilestones';
import { useGameState } from '../../useGameState';
import { getGameDayOfYear, getGameYearLengthDays } from '../../utils/timeOfDay';

export function SeasonDateControl() {
    const { enableDebugHudFlag } = useGameFlags();
    const currentTime = useLiveTime();
    const seasonState = useSeasonState();
    const setSceneDate = useGameState((state) => state.setSceneDate);
    const setSceneDayOfYear = useGameState((state) => state.setSceneDayOfYear);
    const year = currentTime.getFullYear();

    if (!enableDebugHudFlag) return null;

    return (
        <div className="grid gap-3">
            <Slider
                aria-label="Day of year"
                min={1}
                max={getGameYearLengthDays(year)}
                step={1}
                value={[getGameDayOfYear(currentTime)]}
                onValueChange={([day]) => setSceneDayOfYear(day)}
                label={
                    <span className="flex flex-wrap justify-between gap-x-2 text-xs">
                        <span>Time of year</span>
                        <output className="font-mono" aria-live="off">
                            {currentTime.toLocaleDateString('hr-HR')} ·{' '}
                            {seasonState.phase} {seasonState.season}
                        </output>
                    </span>
                }
            />
            <div className="flex flex-wrap gap-1">
                {getSeasonDebugMilestones(year).map(({ key, label, date }) => (
                    <Button
                        key={key}
                        type="button"
                        size="sm"
                        variant="plain"
                        className="h-7 px-2 text-xs"
                        onClick={() => setSceneDate(date)}
                    >
                        {label}
                    </Button>
                ))}
            </div>
        </div>
    );
}
