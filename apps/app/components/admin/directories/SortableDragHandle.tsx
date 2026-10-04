import type { ButtonHTMLAttributes } from 'react';

type SortableDragHandleSize = 'default' | 'compact';

export function SortableDragHandle({
    className,
    size = 'default',
    title = 'Promijeni poredak',
    'aria-label': ariaLabel = 'Promijeni poredak',
    ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
    size?: SortableDragHandleSize;
}) {
    const sizeClassName =
        size === 'compact'
            ? 'min-h-7 w-6 rounded-sm'
            : 'min-h-12 w-8 rounded-md';
    const dotClassName = size === 'compact' ? 'size-0.5' : 'size-1';
    const classNames = [
        'flex shrink-0 cursor-grab touch-none items-center justify-center border border-transparent text-muted-foreground/60 outline-hidden transition-colors hover:border-border hover:bg-muted/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:cursor-grabbing',
        sizeClassName,
        className,
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <button
            {...rest}
            type="button"
            title={title}
            aria-label={ariaLabel}
            className={classNames}
        >
            <span
                className="grid grid-cols-2 gap-x-0.5 gap-y-1"
                aria-hidden="true"
            >
                <span className={`${dotClassName} rounded-full bg-current`} />
                <span className={`${dotClassName} rounded-full bg-current`} />
                <span className={`${dotClassName} rounded-full bg-current`} />
                <span className={`${dotClassName} rounded-full bg-current`} />
                <span className={`${dotClassName} rounded-full bg-current`} />
                <span className={`${dotClassName} rounded-full bg-current`} />
            </span>
        </button>
    );
}
