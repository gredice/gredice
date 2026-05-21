'use client';

import * as SliderPrimitive from '@radix-ui/react-slider';
import { type ComponentProps, type ReactNode, useId } from 'react';
import { cx } from '../utils';

export type SliderProps = ComponentProps<typeof SliderPrimitive.Root> & {
    label?: ReactNode;
    rangeClassName?: string;
    thumbClassName?: string;
    trackClassName?: string;
};

export function Slider({
    className,
    id,
    label,
    name,
    rangeClassName,
    thumbClassName,
    trackClassName,
    ...props
}: SliderProps) {
    const generatedId = useId();
    const sliderId = id ?? name ?? generatedId;
    const labelId = label ? `${sliderId}-label` : undefined;
    const {
        'aria-label': ariaLabel,
        'aria-labelledby': ariaLabelledBy,
        ...rootProps
    } = props;

    const slider = (
        <SliderPrimitive.Root
            className={cx(
                'relative flex w-full touch-none select-none items-center data-[disabled]:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col',
                className,
            )}
            id={sliderId}
            name={name}
            {...rootProps}
        >
            <SliderPrimitive.Track
                className={cx(
                    'relative h-2 w-full grow overflow-hidden rounded-full bg-secondary data-[orientation=vertical]:h-full data-[orientation=vertical]:w-2',
                    trackClassName,
                )}
            >
                <SliderPrimitive.Range
                    className={cx(
                        'absolute h-full bg-primary data-[orientation=vertical]:w-full',
                        rangeClassName,
                    )}
                />
            </SliderPrimitive.Track>
            <SliderPrimitive.Thumb
                aria-label={ariaLabel}
                aria-labelledby={
                    ariaLabel ? undefined : (ariaLabelledBy ?? labelId)
                }
                className={cx(
                    'block size-5 rounded-full border-2 border-primary bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
                    thumbClassName,
                )}
            />
        </SliderPrimitive.Root>
    );

    if (!label) {
        return slider;
    }

    return (
        <div className="space-y-2">
            <span className="block text-sm font-medium" id={labelId}>
                {label}
            </span>
            {slider}
        </div>
    );
}
