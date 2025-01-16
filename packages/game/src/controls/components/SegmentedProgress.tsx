import { cx } from "@signalco/ui-primitives/cx";
import { Progress } from "./Progress";
import { HTMLAttributes } from "react";

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
                            'h-full',
                            index !== 0 && index !== segments.length - 1 && 'rounded-none',
                            index === 0 && 'rounded-r-none',
                            index === segments.length - 1 && 'rounded-l-none'
                        )} />
                    <div className="w-12 -m-2 rounded-full bg-primary" />
                </>
            ))}
        </div>
    )
}