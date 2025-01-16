import * as ProgressPrimitive from "@radix-ui/react-progress"
import { cx } from '@signalco/ui-primitives/cx';
import React from 'react';

export interface ProgressProps
    extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
    indeterminate?: boolean;
}

const Progress = React.forwardRef<
    React.ElementRef<typeof ProgressPrimitive.Root>,
    ProgressProps
>(({ className, value, indeterminate = false, ...props }, ref) => (
    <ProgressPrimitive.Root
        ref={ref}
        className={cx(
            "relative h-4 w-full overflow-hidden rounded-full bg-secondary",
            className
        )}
        {...props}
    >
        <ProgressPrimitive.Indicator
            className={cx(
                "h-full w-full flex-1 bg-green-500 transition-all",
                indeterminate && "animate-progress bg-primary/10 origin-left"
            )}
            style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
        />
    </ProgressPrimitive.Root>
));
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };