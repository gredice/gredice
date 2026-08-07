import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
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
        <div className="mt-1 flex justify-between px-0.5">
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
        <Stack spacing={2}>
            <Row justifyContent="space-between">
                <Typography component="h2" level="h5">
                    Rast biljke
                </Typography>
                <Typography level="body2" secondary>
                    {currentWeeks}. tjedan od {totalWeeks}
                </Typography>
            </Row>
            <Stack>
                <Row justifyContent="space-between">
                    <span
                        aria-label="Sjemenka"
                        className="shrink-0 text-lg"
                        role="img"
                    >
                        🌱
                    </span>
                    <span
                        aria-label="Rastuća biljka"
                        className="shrink-0 text-lg"
                        role="img"
                    >
                        🌿
                    </span>
                    <span
                        aria-label="Zrela biljka"
                        className="shrink-0 text-lg"
                        role="img"
                    >
                        🥬
                    </span>
                </Row>
                <label className="flex h-8 flex-1 cursor-pointer items-center">
                    <input
                        type="range"
                        min={0}
                        max={maxGeneration}
                        step={0.1}
                        value={generation}
                        onChange={onSliderChange}
                        aria-label="Odaberi fazu rasta biljke"
                        aria-valuetext={`${currentWeeks} od ${totalWeeks} tjedana`}
                        className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-green-600 bg-gradient-to-r from-green-100 via-green-300 to-green-600"
                    />
                </label>
                <SliderTickMarks totalWeeks={totalWeeks} />
            </Stack>
        </Stack>
    );
}
