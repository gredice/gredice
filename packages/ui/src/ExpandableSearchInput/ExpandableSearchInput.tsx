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
    const [isExpanded, setIsExpanded] = useState(Boolean(value));
    const rootRef = useRef<HTMLDivElement>(null);
    const mobileInputRootRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isExpanded) {
            mobileInputRootRef.current?.querySelector('input')?.focus();
        }
    }, [isExpanded]);

    useEffect(() => {
        if (value) {
            setIsExpanded(true);
        }
    }, [value]);

    useEffect(() => {
        const handlePointerDown = (event: PointerEvent) => {
            if (
                !(event.target instanceof Node) ||
                !rootRef.current?.contains(event.target)
            ) {
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
                    onClick={() => setIsExpanded(true)}
                >
                    <Search className="size-5" />
                </IconButton>
                {isExpanded && (
                    <div
                        ref={mobileInputRootRef}
                        className="absolute right-0 top-full z-20 mt-2 w-[min(18rem,calc(100vw-2rem))]"
                    >
                        <Input
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
