'use client';

import { Search } from '@signalco/ui-icons';
import { cx } from '@signalco/ui-primitives/cx';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { Input } from '@signalco/ui-primitives/Input';
import { type ChangeEvent, useEffect, useRef, useState } from 'react';

export type ExpandableSearchInputProps = {
    value: string;
    onChange: (event: ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
    className?: string;
    inputClassName?: string;
};

export function ExpandableSearchInput({
    value,
    onChange,
    placeholder = 'Pretraži...',
    className,
    inputClassName,
}: ExpandableSearchInputProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const desktopInputRef = useRef<HTMLInputElement>(null);
    const mobileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isExpanded) {
            mobileInputRef.current?.focus();
        }
    }, [isExpanded]);

    useEffect(() => {
        const handlePointerDown = (event: PointerEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) {
                setIsExpanded(false);
            }
        };

        document.addEventListener('pointerdown', handlePointerDown);
        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
        };
    }, []);

    return (
        <div ref={rootRef} className={cx('relative', className)}>
            <div className="hidden md:block">
                <Input
                    ref={desktopInputRef}
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    startDecorator={<Search className="size-5 shrink-0 ml-3" />}
                    className={inputClassName}
                />
            </div>
            <div className="md:hidden">
                <IconButton
                    variant="plain"
                    title="Pretraži"
                    onClick={() => setIsExpanded((open) => !open)}
                >
                    <Search className="size-5" />
                </IconButton>
                {isExpanded && (
                    <div className="absolute right-0 top-full z-20 mt-2 w-[min(18rem,calc(100vw-2rem))]">
                        <Input
                            ref={mobileInputRef}
                            value={value}
                            onChange={onChange}
                            placeholder={placeholder}
                            startDecorator={
                                <Search className="size-5 shrink-0 ml-3" />
                            }
                            className={inputClassName}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
