import { Check } from '@signalco/ui-icons';
import { cx } from '@signalco/ui-primitives/cx';
import { Fragment, type HTMLAttributes } from 'react';
import { Progress } from './Progress';

export type SegmentedProgressProps = {
    segments: {
        value: number;
        indeterminate?: boolean;
        highlighted?: boolean;
        label?: string;
        onClick?: () => void;
    }[];
} & HTMLAttributes<HTMLDivElement>;

export function SegmentedProgress({
    className,
    segments,
    ...rest
}: SegmentedProgressProps) {
    return (
        <div className={cx('flex relative', className)} {...rest}>
            {segments.map((segment, index) => {
                const CircleComponent = segment.onClick ? 'button' : 'div';

                return (
                    <Fragment key={segment.label ?? index}>
                        <Progress
                            // biome-ignore lint/suspicious/noArrayIndexKey: Using array index as key is acceptable here
                            key={index}
                            value={segment.value}
                            indeterminate={segment.indeterminate}
                            className={cx(
                                'h-2',
                                index !== 0 &&
                                    index !== segments.length - 1 &&
                                    'rounded-none',
                                index === 0 && 'rounded-r-none',
                                index === segments.length - 1 &&
                                    'rounded-l-none',
                            )}
                        />
                        <CircleComponent
                            onClick={segment.onClick}
                            type={segment.onClick ? 'button' : undefined}
                            className={cx(
                                'relative size-4 rounded-full -ml-1 -mt-1 bg-background border-2 border-tertiary shrink-0 z-10',
                                segment.value >= 100 && 'bg-green-500',
                                segment.value >= 100 && 'border-green-600',
                                segment.indeterminate && 'border-none',
                                segment.onClick &&
                                    'cursor-pointer hover:outline outline-offset-1 outline-2',
                            )}
                        >
                            <div
                                className={cx(
                                    'absolute inset-0 flex items-center justify-center',
                                    (segment.highlighted ||
                                        segment.indeterminate) &&
                                        'border-green-500 border-2 rounded-full animate-pulse',
                                )}
                            >
                                <Check
                                    className={cx(
                                        'size-3 text-white',
                                        segment.value < 100 && 'hidden',
                                    )}
                                />
                            </div>
                            <div className="select-none text-xs text-center absolute left-1/2 top-full transform -translate-x-1/2 pt-1">
                                {segment.label}
                            </div>
                        </CircleComponent>
                    </Fragment>
                );
            })}
        </div>
    );
}
