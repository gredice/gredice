'use client';

import { Down } from '@signalco/ui-icons';
import {
    type PropsWithChildren,
    type ReactElement,
    useId,
    useState,
} from 'react';

type NavGroupProps = PropsWithChildren<{
    label: string;
    icon?: ReactElement;
    defaultOpen?: boolean;
    forceOpen?: boolean;
    compact?: boolean;
    className?: string;
    depth?: 0 | 1 | 2;
}>;

export function NavGroup({
    label,
    icon,
    defaultOpen = false,
    forceOpen = false,
    compact = false,
    className,
    depth = 0,
    children,
}: NavGroupProps) {
    const [open, setOpen] = useState(defaultOpen);
    const visible = open || forceOpen;
    const contentId = useId();
    const rootClassName = className ? `space-y-1 ${className}` : 'space-y-1';
    const isNested = depth > 0;
    const buttonClassName = [
        'group/nav-group relative flex w-full items-center gap-2 rounded-md text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        depth === 0
            ? 'h-8 px-2 text-foreground text-sm font-medium hover:bg-muted/70'
            : 'h-8 px-2 text-foreground text-sm hover:bg-muted/70',
        isNested
            ? "before:absolute before:-left-3 before:top-1/2 before:h-px before:w-3 before:bg-border/55 before:content-['']"
            : '',
    ]
        .filter(Boolean)
        .join(' ');
    const contentClassName = [
        'relative ml-[18px] space-y-1 pl-3',
        "before:absolute before:left-0 before:top-0 before:bottom-4 before:w-px before:content-['']",
        depth === 0 ? 'before:bg-border/65' : 'before:bg-border/45',
    ].join(' ');

    if (compact) {
        return <div className={rootClassName}>{children}</div>;
    }

    return (
        <section className={rootClassName}>
            <button
                type="button"
                aria-expanded={visible}
                aria-controls={contentId}
                onClick={() => setOpen((value) => !value)}
                className={buttonClassName}
            >
                <span className="flex size-6 shrink-0 items-center justify-center text-foreground">
                    {icon}
                </span>
                <span className="min-w-0 flex-1 truncate">{label}</span>
                <Down
                    className={`size-3.5 shrink-0 transition-transform ${
                        visible ? '' : '-rotate-90'
                    }`}
                />
            </button>
            {visible && (
                <div id={contentId} className={contentClassName}>
                    {children}
                </div>
            )}
        </section>
    );
}
