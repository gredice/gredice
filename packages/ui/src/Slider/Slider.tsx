'use client';

import { DirectionProvider } from '@base-ui/react/direction-provider';
import { Slider as SliderPrimitive } from '@base-ui/react/slider';
import type { HTMLAttributes, ReactNode } from 'react';
import { useId, useLayoutEffect, useRef, useState } from 'react';
import type { UiDirection, UiOrientation } from '../lib/primitiveTypes';
import { cx } from '../utils';

export type SliderProps = Omit<
    HTMLAttributes<HTMLDivElement>,
    'defaultValue' | 'onChange'
> & {
    defaultValue?: number[];
    dir?: UiDirection;
    disabled?: boolean;
    form?: string;
    inverted?: boolean;
    label?: ReactNode;
    max?: number;
    min?: number;
    minStepsBetweenThumbs?: number;
    name?: string;
    onValueChange?(value: number[]): void;
    onValueCommit?(value: number[]): void;
    orientation?: UiOrientation;
    rangeClassName?: string;
    step?: number;
    thumbClassName?: string;
    trackClassName?: string;
    value?: number[];
};

function invertValues(values: number[] | undefined, min: number, max: number) {
    if (!values) {
        return undefined;
    }

    return values.map((value) => min + max - value).reverse();
}

export function Slider({
    className,
    defaultValue,
    dir,
    disabled,
    form,
    id,
    inverted = false,
    label,
    max = 100,
    min = 0,
    minStepsBetweenThumbs,
    name,
    onValueChange,
    onValueCommit,
    orientation = 'horizontal',
    rangeClassName,
    step,
    thumbClassName,
    trackClassName,
    value,
    ...rootAttributes
}: SliderProps) {
    const generatedId = useId();
    const sliderId = id ?? name ?? generatedId;
    const {
        'aria-label': ariaLabel,
        'aria-labelledby': ariaLabelledBy,
        ...restRootAttributes
    } = rootAttributes;
    const verticalInverted = inverted && orientation === 'vertical';
    const resolvedDirection =
        inverted && orientation === 'horizontal'
            ? dir === 'rtl'
                ? 'ltr'
                : 'rtl'
            : dir;
    const [uncontrolledValue, setUncontrolledValue] = useState(
        defaultValue ?? [min],
    );
    const publicValue = value ?? uncontrolledValue;
    const internalDefaultValue = verticalInverted
        ? invertValues(defaultValue ?? [min], min, max)
        : defaultValue;
    const internalValue = verticalInverted
        ? invertValues(value, min, max)
        : value;
    const thumbInputRefs = useRef<Array<HTMLInputElement | null>>([]);
    const thumbCount = value?.length ?? defaultValue?.length ?? 1;

    function toPublicValue(nextValue: number[]) {
        return verticalInverted
            ? (invertValues(nextValue, min, max) ?? [])
            : [...nextValue];
    }

    function handleValueChange(nextValue: number[]) {
        const nextPublicValue = toPublicValue(nextValue);

        if (value === undefined) {
            setUncontrolledValue(nextPublicValue);
        }

        onValueChange?.(nextPublicValue);
    }

    useLayoutEffect(() => {
        if (!verticalInverted) {
            return;
        }

        const publicThumbValues = [...publicValue].reverse();
        for (const [index, input] of thumbInputRefs.current.entries()) {
            const thumbValue = publicThumbValues[index];

            if (!input || thumbValue === undefined) {
                continue;
            }

            input.setAttribute('aria-valuenow', String(thumbValue));
            input.setAttribute('aria-valuetext', String(thumbValue));
        }
    }, [publicValue, verticalInverted]);

    return (
        <DirectionProvider direction={resolvedDirection}>
            <SliderPrimitive.Root
                className={cx(
                    'w-full data-[disabled]:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto',
                    label && 'space-y-2',
                    className,
                )}
                defaultValue={internalDefaultValue}
                dir={resolvedDirection}
                disabled={disabled}
                form={verticalInverted ? undefined : form}
                id={sliderId}
                max={max}
                min={min}
                minStepsBetweenValues={minStepsBetweenThumbs}
                name={verticalInverted ? undefined : name}
                onValueChange={handleValueChange}
                onValueCommitted={(nextValue) =>
                    onValueCommit?.(toPublicValue(nextValue))
                }
                orientation={orientation}
                step={step}
                value={internalValue}
                {...restRootAttributes}
            >
                {label ? (
                    <SliderPrimitive.Label className="block text-sm font-medium">
                        {label}
                    </SliderPrimitive.Label>
                ) : null}
                <SliderPrimitive.Control
                    className={cx(
                        'relative flex w-full touch-none select-none items-center data-[orientation=vertical]:h-full data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col',
                    )}
                >
                    <SliderPrimitive.Track
                        className={cx(
                            'relative h-2 w-full grow rounded-full bg-secondary data-[orientation=vertical]:h-full data-[orientation=vertical]:w-2',
                            trackClassName,
                        )}
                    >
                        <SliderPrimitive.Indicator
                            className={cx(
                                'rounded-full bg-primary',
                                rangeClassName,
                            )}
                        />
                        {Array.from({ length: thumbCount }, (_, index) => (
                            <SliderPrimitive.Thumb
                                aria-label={ariaLabel}
                                aria-labelledby={
                                    ariaLabel ? undefined : ariaLabelledBy
                                }
                                className={cx(
                                    'block size-5 rounded-full border-2 border-primary bg-background ring-offset-background transition-colors has-[:focus-visible]:outline-hidden has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
                                    thumbClassName,
                                )}
                                index={index}
                                inputRef={(input) => {
                                    thumbInputRefs.current[index] = input;
                                }}
                                // biome-ignore lint/suspicious/noArrayIndexKey: Thumb slots have stable positional identity.
                                key={`thumb-${index}`}
                            />
                        ))}
                    </SliderPrimitive.Track>
                </SliderPrimitive.Control>
            </SliderPrimitive.Root>
            {verticalInverted && name
                ? publicValue.map((currentValue, index) => (
                      <input
                          disabled={disabled}
                          form={form}
                          // biome-ignore lint/suspicious/noArrayIndexKey: Slider values have stable positional identity.
                          key={`${sliderId}-value-${index}`}
                          name={name}
                          type="hidden"
                          value={currentValue}
                      />
                  ))
                : null}
        </DirectionProvider>
    );
}
