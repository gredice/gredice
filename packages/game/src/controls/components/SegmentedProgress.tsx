import { cx } from "@signalco/ui-primitives/cx";
import { Progress } from "./Progress";
import { Fragment, HTMLAttributes } from "react";
import { Check } from "@signalco/ui-icons";

export type SegmentedProgressProps = {
    segments: { value: number, indeterminate?: boolean, highlighted?: boolean, label?: string }[]
} & HTMLAttributes<HTMLDivElement>;

export function SegmentedProgress({ className, segments, ...rest }: SegmentedProgressProps) {
    return (
        <div className={cx("flex relative", className)} {...rest}>
            {segments.map((segment, index) => (
                <Fragment key={segment.label ?? index}>
                    <Progress
                        key={index}
                        value={segment.value}
                        indeterminate={segment.indeterminate}
                        className={cx(
                            'h-2',
                            index !== 0 && index !== segments.length - 1 && 'rounded-none',
                            index === 0 && 'rounded-r-none',
                            index === segments.length - 1 && 'rounded-l-none'
                        )} />
                    <div className={cx(
                        "relative size-4 rounded-full -ml-1 -mt-1 bg-background border-2 border-tertiary shrink-0 z-10",
                        segment.value >= 100 && 'bg-green-500',
                        segment.value >= 100 && 'border-green-600',
                        segment.indeterminate && 'border-none'
                    )}>
                        <div className={cx(
                            "absolute inset-0 flex items-center justify-center",
                            (segment.highlighted || segment.indeterminate) && 'border-green-500 border-2 rounded-full animate-pulse'
                        )}>
                            <Check className={cx("size-3 text-white", segment.value < 100 && 'hidden')} />
                        </div>
                        <div className="select-none text-xs text-center absolute left-1/2 top-full transform -translate-x-1/2 pt-1">
                            {segment.label}
                        </div>
                    </div>
                </Fragment>
            ))}
        </div>
    )
}