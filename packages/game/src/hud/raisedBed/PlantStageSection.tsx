import { ExternalLink } from '@signalco/ui-icons';
import { Chip } from '@signalco/ui-primitives/Chip';
import { Link } from '@signalco/ui-primitives/Link';
import { Popper } from '@signalco/ui-primitives/Popper';
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
    stageDescription?: string;
    plantDetailsUrl?: string;
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
    stageDescription,
    plantDetailsUrl,
    variant = 'range',
}: PlantStageSectionProps) {
    const hasWindow =
        typeof windowMin === 'number' || typeof windowMax === 'number';
    const expectedDuration = formatExpectedDuration(windowMin, windowMax);
    const hasDays = startDate && typeof daysCount === 'number' && dayPlural;

    return (
        <Row spacing={0.5} alignItems="center" className="min-w-0 flex-wrap">
            <LegendDot
                legendColorClass={legendColorClass}
                legendBorderColorClass={legendBorderColorClass}
                legendFilled={legendFilled}
                legendPulse={legendPulse}
            />
            <Typography level="body2" semiBold noWrap>
                {label}:
            </Typography>
            {hasDays ? (
                <StageDurationDetails
                    label={label}
                    startDate={startDate}
                    endDate={endDate}
                    endFallbackText={endFallbackText}
                    daysCount={daysCount}
                    dayPlural={dayPlural}
                    expectedDuration={hasWindow ? expectedDuration : null}
                    stageDescription={stageDescription}
                    plantDetailsUrl={plantDetailsUrl}
                    variant={variant}
                />
            ) : (
                <Typography level="body2" secondary>
                    {fallbackText}
                </Typography>
            )}
        </Row>
    );
}

function LegendDot({
    legendColorClass,
    legendBorderColorClass,
    legendPulse,
    legendFilled,
}: Pick<
    PlantStageSectionProps,
    | 'legendColorClass'
    | 'legendBorderColorClass'
    | 'legendPulse'
    | 'legendFilled'
>) {
    if (!legendColorClass) {
        return null;
    }

    return (
        <span className="inline-block relative size-2.5" aria-hidden="true">
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
    );
}

function StageDurationDetails({
    label,
    startDate,
    endDate,
    endFallbackText,
    daysCount,
    dayPlural,
    expectedDuration,
    stageDescription,
    plantDetailsUrl,
    variant,
}: {
    label: string;
    startDate: Date;
    endDate?: Date | null;
    endFallbackText: string;
    daysCount: number;
    dayPlural: string;
    expectedDuration: string | null;
    stageDescription?: string;
    plantDetailsUrl?: string;
    variant: 'range' | 'single';
}) {
    const durationText = `${daysCount} ${dayPlural}`;
    const dateText =
        variant === 'range'
            ? endDate
                ? formatCompactDateRange(startDate, endDate)
                : `${formatCompactDate(startDate)} - ${endFallbackText}`
            : `od ${formatCompactDate(startDate)}`;

    return (
        <Popper
            side="bottom"
            sideOffset={8}
            className="w-72 max-w-[calc(100vw-2rem)] border-tertiary border-b-4 p-3"
            trigger={
                <button
                    type="button"
                    className="inline-flex rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-700 focus-visible:ring-offset-2"
                    aria-label={`${label}: ${durationText}`}
                    title={`${label}: ${durationText}`}
                >
                    <Chip className="w-fit cursor-pointer" size="sm">
                        {durationText}
                    </Chip>
                </button>
            }
        >
            <Stack spacing={1}>
                <Typography level="body2" semiBold>
                    {label}
                </Typography>
                {stageDescription && (
                    <Typography level="body3" secondary>
                        {stageDescription}
                    </Typography>
                )}
                <Typography level="body2">{dateText}</Typography>
                {expectedDuration && (
                    <Typography level="body3" secondary>
                        Očekivano za ovu sortu: {expectedDuration}
                    </Typography>
                )}
                {plantDetailsUrl && (
                    <Link
                        href={plantDetailsUrl}
                        target="_blank"
                        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-muted-foreground/60"
                    >
                        Detalji o biljci
                        <ExternalLink className="size-3.5" />
                    </Link>
                )}
            </Stack>
        </Popper>
    );
}

function formatExpectedDuration(
    windowMin: number | null | undefined,
    windowMax: number | null | undefined,
) {
    if (typeof windowMin === 'number' && typeof windowMax === 'number') {
        return windowMin === windowMax
            ? `${windowMin} dana`
            : `${windowMin}-${windowMax} dana`;
    }

    if (typeof windowMin === 'number') {
        return `od ${windowMin} dana`;
    }

    if (typeof windowMax === 'number') {
        return `do ${windowMax} dana`;
    }

    return null;
}

function formatCompactDate(date: Date) {
    return `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}.`;
}

export function formatCompactDateRange(startDate: Date, endDate: Date) {
    const startDay = startDate.getDate();
    const startMonth = startDate.getMonth() + 1;
    const startYear = startDate.getFullYear();
    const endDay = endDate.getDate();
    const endMonth = endDate.getMonth() + 1;
    const endYear = endDate.getFullYear();

    if (startYear === endYear && startMonth === endMonth) {
        return `${startDay}.-${endDay}.${endMonth}.${endYear}.`;
    }

    if (startYear === endYear) {
        return `${startDay}.${startMonth}.-${endDay}.${endMonth}.${endYear}.`;
    }

    return `${startDay}.${startMonth}.${startYear}.-${endDay}.${endMonth}.${endYear}.`;
}
