import { PlantOrSortImage } from '@gredice/ui/plants';
import { SegmentedCircularProgress } from '@gredice/ui/SegmentedCircularProgress';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';

export type RaisedBedAdvancedSowingFieldSegment = {
    coverUrl: string | null;
    label: string;
    value: string;
};

export function RaisedBedAdvancedSowingFieldItem({
    disabled,
    onSelect,
    positionIndex,
    segments,
}: {
    disabled: boolean;
    onSelect: (value: string) => void;
    positionIndex: number;
    segments: readonly RaisedBedAdvancedSowingFieldSegment[];
}) {
    return (
        <div
            className={cx(
                'relative flex size-full items-center justify-center overflow-hidden rounded-xs bg-gradient-to-br from-lime-100/90 to-lime-100/80 text-primary dark:from-emerald-950/95 dark:to-lime-950/90 dark:text-lime-50 dark:ring-1 dark:ring-lime-100/10',
                disabled ? 'pointer-events-none' : 'pointer-events-auto',
            )}
            data-advanced-sowing-field-position={positionIndex}
        >
            <div
                className="pointer-events-none absolute left-0.5 top-0 z-20"
                data-raised-bed-field-position-label
            >
                <Typography
                    className="text-lime-700 dark:text-lime-200"
                    level="body3"
                >
                    {positionIndex + 1}
                </Typography>
            </div>
            <SegmentedCircularProgress
                segments={segments.map((_, index) => ({
                    borderColor:
                        index % 2 === 0
                            ? 'stroke-emerald-500'
                            : 'stroke-blue-500',
                    color:
                        index % 2 === 0
                            ? 'stroke-emerald-500'
                            : 'stroke-blue-500',
                    percentage: 100 / segments.length,
                    trackColor:
                        index % 2 === 0
                            ? 'stroke-emerald-50 dark:stroke-emerald-50/80'
                            : 'stroke-blue-50 dark:stroke-blue-50/80',
                    value: 100,
                }))}
                size={70}
                strokeWidth={4}
            >
                <div
                    className="grid size-[52px] overflow-hidden rounded-full bg-white dark:bg-emerald-950"
                    style={{
                        gridTemplateColumns: `repeat(${segments.length.toString()}, minmax(0, 1fr))`,
                    }}
                >
                    {segments.map((segment, index) => (
                        <span
                            className={cx(
                                'flex min-w-0 items-center justify-center overflow-hidden',
                                index > 0 &&
                                    'border-l border-emerald-800/20 dark:border-lime-100/20',
                            )}
                            key={segment.value}
                        >
                            <PlantOrSortImage
                                alt={segment.label}
                                className={cx(
                                    'object-contain',
                                    segments.length === 1
                                        ? 'size-[52px]'
                                        : 'h-[52px] w-full',
                                )}
                                coverUrl={segment.coverUrl}
                                height={52}
                                width={segments.length === 1 ? 52 : 26}
                            />
                        </span>
                    ))}
                </div>
            </SegmentedCircularProgress>
            <div
                className="absolute inset-0 z-10 grid"
                style={{
                    gridTemplateColumns: `repeat(${segments.length.toString()}, minmax(0, 1fr))`,
                }}
            >
                {segments.map((segment) => (
                    <button
                        aria-label={`Otvori detalje biljke ${segment.label} na polju ${(positionIndex + 1).toString()}`}
                        className="min-w-0 transition-colors hover:bg-emerald-100/25 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-lime-700 dark:hover:bg-emerald-900/20"
                        data-advanced-sowing-details-trigger={segment.value}
                        data-advanced-sowing-field-plant={segment.value}
                        data-advanced-sowing-field-segment={segment.value}
                        disabled={disabled}
                        key={segment.value}
                        onClick={() => onSelect(segment.value)}
                        title={segment.label}
                        type="button"
                    />
                ))}
            </div>
        </div>
    );
}
