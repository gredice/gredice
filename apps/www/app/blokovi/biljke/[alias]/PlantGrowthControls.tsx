import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import type { ChangeEvent } from 'react';
import { useMemo } from 'react';

function SliderTickMarks({ totalWeeks }: { totalWeeks: number }) {
    const ticks = useMemo(() => {
        const result: number[] = [0];
        const midWeek = Math.round(totalWeeks / 2);
        if (midWeek > 0 && midWeek < totalWeeks) {
            result.push(midWeek);
        }
        result.push(totalWeeks);
        return result;
    }, [totalWeeks]);

    return (
        <div className="flex justify-between px-0.5 mt-1">
            {ticks.map((week) => (
                <Typography key={week} level="body3" secondary>
                    {week} tj.
                </Typography>
            ))}
        </div>
    );
}

export function PlantGrowthControls({
    currentWeeks,
    totalWeeks,
    generation,
    maxGeneration,
    onSliderChange,
}: {
    currentWeeks: number;
    totalWeeks: number;
    generation: number;
    maxGeneration: number;
    onSliderChange: (e: ChangeEvent<HTMLInputElement>) => void;
}) {
    return (
        <Stack spacing={1}>
            <Row justifyContent="space-between">
                <Typography level="h5">Rast biljke</Typography>
                <Typography level="body2" secondary>
                    {currentWeeks} / {totalWeeks} tjedana
                </Typography>
            </Row>
            <Stack>
                <Row justifyContent="space-between">
                    <span className="text-lg shrink-0" title="Sjemenka">
                        🌱
                    </span>
                    <span className="text-lg shrink-0" title="Rastuća biljka">
                        🌿
                    </span>
                    <span className="text-lg shrink-0" title="Zrela biljka">
                        🥬
                    </span>
                </Row>
                <div className="flex-1">
                    <input
                        type="range"
                        min={0}
                        max={maxGeneration}
                        step={0.1}
                        value={generation}
                        onChange={onSliderChange}
                        className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-green-600 bg-gradient-to-r from-green-100 via-green-300 to-green-600"
                    />
                </div>
                <SliderTickMarks totalWeeks={totalWeeks} />
            </Stack>
        </Stack>
    );
}
