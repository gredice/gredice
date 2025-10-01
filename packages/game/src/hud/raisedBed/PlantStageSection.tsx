import { Chip } from '@signalco/ui-primitives/Chip';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';

export type PlantStageSectionProps = {
    label: string;
    legendColorClass?: string; // Tailwind bg-* color class for the legend dot
    legendBorderColorClass?: string; // Tailwind border-* or ring-* color class for the legend outline
    legendPulse?: boolean; // Whether the legend dot should pulse
    legendFilled?: boolean; // Filled state; when false and not pulsing, dot is outlined only
    windowMin?: number | null;
    windowMax?: number | null;
    startDate?: Date | null;
    endDate?: Date | null; // Used for the 'range' variant
    endFallbackText?: string; // Text to show when no endDate in 'range'
    daysCount?: number;
    dayPlural?: string; // e.g. 'dan' | 'dana'
    fallbackText: string; // Text to show when no startDate
    variant?: 'range' | 'single';
};

export function PlantStageSection({
    label,
    legendColorClass,
    legendBorderColorClass,
    legendPulse,
    legendFilled,
    windowMin,
    windowMax,
    startDate,
    endDate,
    endFallbackText = 'U tijeku...',
    daysCount,
    dayPlural,
    fallbackText,
    variant = 'range',
}: PlantStageSectionProps) {
    const hasWindow =
        typeof windowMin === 'number' || typeof windowMax === 'number';

    const formattedStart = startDate
        ? startDate.toLocaleDateString('hr-HR')
        : null;
    const formattedEnd = endDate ? endDate.toLocaleDateString('hr-HR') : null;

    return (
        <Stack>
            <Typography level="body3">
                {legendColorClass ? (
                    <span
                        className="mr-2 inline-block relative size-2.5"
                        aria-hidden="true"
                    >
                        {/* Outer static outline */}
                        <span
                            className={`block size-2.5 rounded-full border ${legendBorderColorClass ?? legendColorClass.replace('bg-', 'border-')}`}
                        />
                        {/* Inner fill (shown when filled or pulsing). Use absolute inset to keep border static. */}
                        {(legendFilled || legendPulse) && (
                            <span
                                className={`absolute inset-[2px] rounded-full ${legendColorClass} ${legendPulse ? 'animate-pulse' : ''}`}
                            />
                        )}
                    </span>
                ) : null}
                {label}
                {hasWindow
                    ? ` (${windowMin ?? ''}-${windowMax ?? ''} dana)`
                    : null}
            </Typography>
            {variant === 'range' ? (
                <div className="grid gap-x-1 items-center grid-cols-[auto_auto_auto] md:grid-cols-[repeat(4,auto)]">
                    <Typography level={formattedStart ? 'body1' : 'body2'}>
                        {formattedStart ?? fallbackText}
                    </Typography>
                    {startDate && (
                        <>
                            <Typography level="body3" noWrap>
                                -
                            </Typography>
                            <Typography
                                level={formattedEnd ? 'body1' : 'body2'}
                                noWrap
                            >
                                {formattedEnd ?? endFallbackText}
                            </Typography>
                            {typeof daysCount === 'number' && dayPlural && (
                                <Chip className="w-fit" size="sm">
                                    {daysCount} {dayPlural}
                                </Chip>
                            )}
                        </>
                    )}
                </div>
            ) : (
                <Row spacing={0.5}>
                    <Typography level={formattedStart ? 'body1' : 'body2'}>
                        {formattedStart ?? fallbackText}
                    </Typography>
                    {startDate &&
                        typeof daysCount === 'number' &&
                        dayPlural && (
                            <Chip className="w-fit" size="sm">
                                {daysCount} {dayPlural}
                            </Chip>
                        )}
                </Row>
            )}
        </Stack>
    );
}
