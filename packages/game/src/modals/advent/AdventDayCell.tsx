'use client';

import { Check } from '@signalco/ui-icons';
import { cx } from '@signalco/ui-primitives/cx';
import { useState } from 'react';
import { adventDayFont } from './fonts';

type DayCellVariant = 'red' | 'green' | 'brown' | 'striped';

type AdventDayCellProps = {
    day: number;
    variant: DayCellVariant;
    isOpen: boolean;
    isToday: boolean;
    isFuture: boolean;
    onClick?: () => void;
    disabled?: boolean;
    colSpan?: number;
};

// Deterministic variant based on day number
export function getDayVariant(day: number): DayCellVariant {
    const variants: DayCellVariant[] = ['red', 'green', 'brown', 'striped'];
    return variants[(day - 1) % 4];
}

function StripedPattern() {
    return (
        <svg
            className="absolute inset-0.5 w-full h-full rounded-sm"
            preserveAspectRatio="none"
            aria-hidden="true"
        >
            <defs>
                <pattern
                    id="diagonal-stripes"
                    patternUnits="userSpaceOnUse"
                    width="10"
                    height="10"
                    patternTransform="rotate(45)"
                >
                    <rect x="0" y="0" width="5" height="10" fill="#F5DEB300" />
                    <rect x="5" y="0" width="5" height="10" fill="#DAA520" />
                </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#diagonal-stripes)" />
        </svg>
    );
}

function DotsPattern() {
    return (
        <svg
            className="absolute inset-0.5 w-full h-full rounded-sm"
            preserveAspectRatio="none"
            aria-hidden="true"
        >
            <defs>
                <pattern
                    id="dots-pattern"
                    patternUnits="userSpaceOnUse"
                    width="12"
                    height="12"
                >
                    <circle cx="3" cy="3" r="2" fill="rgba(255,255,255,0.3)" />
                    <circle cx="9" cy="9" r="2" fill="rgba(255,255,255,0.3)" />
                </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dots-pattern)" />
        </svg>
    );
}

function WavePattern() {
    return (
        <svg
            className="absolute inset-0.5 w-full h-full rounded-sm"
            preserveAspectRatio="none"
            aria-hidden="true"
        >
            <defs>
                <pattern
                    id="wave-pattern"
                    patternUnits="userSpaceOnUse"
                    width="20"
                    height="10"
                >
                    <path
                        d="M0 5 Q5 0 10 5 T20 5"
                        stroke="rgba(255,255,255,0.25)"
                        strokeWidth="2"
                        fill="none"
                    />
                </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#wave-pattern)" />
        </svg>
    );
}

export function AdventDayCell({
    day,
    variant,
    isOpen,
    isToday,
    isFuture,
    onClick,
    disabled,
    colSpan = 1,
}: AdventDayCellProps) {
    const [isWobbling, setIsWobbling] = useState(false);

    const handleClick = () => {
        if (isFuture && !isOpen) {
            // Trigger wobble animation for future days
            setIsWobbling(true);
            setTimeout(() => setIsWobbling(false), 500);
            return;
        }
        onClick?.();
    };
    const variantClasses: Record<DayCellVariant, string> = {
        red: 'bg-[#8B0000]',
        green: 'bg-[#1B5E20]',
        brown: 'bg-[#5D4037]',
        striped: 'bg-[#F5DEB3]',
    };

    // Border colors matching each variant
    const variantBorderClasses: Record<DayCellVariant, string> = {
        red: 'border-[#6B0000]',
        green: 'border-[#0D3D10]',
        brown: 'border-[#3E2A25]',
        striped: 'border-[#DAA520]',
    };

    const variantOpenBgClasses: Record<DayCellVariant, string> = {
        red: 'bg-[#6B0000]',
        green: 'bg-[#0D3D10]',
        brown: 'bg-[#3E2723]',
        striped: 'bg-[#DAA520]',
    };

    const baseClasses = cx(
        'overflow-hidden relative w-full rounded-sm h-full flex items-center justify-center font-bold text-2xl transition-all duration-200',
        'cursor-pointer hover:bg-white/30 hover:scale-105 active:scale-95',
    );

    const wrapperClasses = cx(
        variantClasses[variant],
        'p-0.5 min-h-0 min-w-0',
        colSpan === 2 && 'col-span-2',
    );

    return (
        <div className={wrapperClasses}>
            <button
                type="button"
                onClick={handleClick}
                disabled={disabled}
                className={cx(
                    baseClasses,
                    !isOpen && variantClasses[variant],
                    isWobbling && 'animate-wobble',
                )}
            >
                {/* Pattern backgrounds with inset - show for closed cells only */}
                {variant === 'striped' && !isOpen && (
                    <div className="absolute inset-0">
                        <StripedPattern />
                    </div>
                )}
                {variant === 'red' && !isOpen && (
                    <div className="absolute inset-0">
                        <DotsPattern />
                    </div>
                )}
                {variant === 'green' && !isOpen && (
                    <div className="absolute inset-0">
                        <WavePattern />
                    </div>
                )}

                {isOpen && (
                    <div
                        className={cx(
                            'inset-0.5 rounded-sm absolute',
                            variantOpenBgClasses[variant],
                        )}
                    ></div>
                )}

                {/* Content - always show number, add checkmark when opened */}
                <div className="relative z-10 flex flex-col items-center justify-center">
                    {isOpen && (
                        <div className="bg-green-700 p-[2px] rounded-full">
                            <div className="bg-green-700 rounded-full border-2 border-green-200">
                                <Check className="text-green-200 size-5 shrink-0" />
                            </div>
                        </div>
                    )}
                    <span
                        className={cx(
                            'text-white drop-shadow-md',
                            adventDayFont.className,
                        )}
                    >
                        {day}
                    </span>
                </div>

                {/* Border for cell separation */}
                <div
                    className={cx(
                        'absolute rounded-sm inset-0.5 border border-dashed pointer-events-none',
                        variantBorderClasses[variant],
                    )}
                />
            </button>
        </div>
    );
}
