import { Stack } from '../Stack';
import { Typography } from '../Typography';

export function SurveyOpinionScale({
    max,
    maxLabel,
    min,
    minLabel,
    onChange,
    step = 1,
    value,
}: {
    max: number;
    maxLabel?: string | null;
    min: number;
    minLabel?: string | null;
    onChange: (value: number) => void;
    step?: number;
    value?: number;
}) {
    const normalizedStep = Number.isInteger(step) && step > 0 ? step : 1;
    const values: number[] = [];
    for (let current = min; current <= max; current += normalizedStep) {
        values.push(current);
    }

    return (
        <Stack spacing={2}>
            <div className="grid grid-cols-6 gap-2 sm:grid-cols-11">
                {values.map((item) => (
                    <button
                        aria-pressed={value === item}
                        className={
                            value === item
                                ? 'h-11 rounded-md bg-primary text-primary-foreground text-sm font-semibold'
                                : 'h-11 rounded-md border bg-background text-sm font-semibold hover:bg-muted'
                        }
                        key={item}
                        type="button"
                        onClick={() => onChange(item)}
                    >
                        {item}
                    </button>
                ))}
            </div>
            {minLabel || maxLabel ? (
                <div className="flex justify-between gap-4">
                    <Typography level="body3" secondary>
                        {minLabel}
                    </Typography>
                    <Typography level="body3" secondary>
                        {maxLabel}
                    </Typography>
                </div>
            ) : null}
        </Stack>
    );
}
