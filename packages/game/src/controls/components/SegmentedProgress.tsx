import { cx } from "@signalco/ui-primitives/cx";
import { Progress } from "./Progress";
import { HTMLAttributes } from "react";
import { Check } from "lucide-react";

export type SegmentedProgressProps = {
    segments: { value: number, indeterminate?: boolean }[]
} & HTMLAttributes<HTMLDivElement>;

export function SegmentedProgress({ className, segments, ...rest }: SegmentedProgressProps) {
    return (
        <div className={cx("flex relative", className)} {...rest}>
            {segments.map((segment, index) => (
                <>
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
                        "size-4 rounded-full -ml-1 -mt-1 bg-white shrink-0 z-10",
                        segment.value >= 100 && 'bg-green-900',
                        segment.indeterminate && 'animate-pulse bg-green-300'
                    )}>
                        <Check className={cx("size-4 text-white", segment.value < 100 && 'hidden')} />
                    </div>
                </>
            ))}
        </div>
    )
}