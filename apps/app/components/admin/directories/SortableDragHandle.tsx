import type { ButtonHTMLAttributes } from 'react';

export function SortableDragHandle({
    className,
    title = 'Promijeni poredak',
    'aria-label': ariaLabel = 'Promijeni poredak',
    ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
    const classNames = [
        'flex min-h-12 w-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-md border border-transparent text-muted-foreground/60 outline-none transition-colors hover:border-border hover:bg-muted/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:cursor-grabbing',
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
                <span className="size-1 rounded-full bg-current" />
                <span className="size-1 rounded-full bg-current" />
                <span className="size-1 rounded-full bg-current" />
                <span className="size-1 rounded-full bg-current" />
                <span className="size-1 rounded-full bg-current" />
                <span className="size-1 rounded-full bg-current" />
            </span>
        </button>
    );
}
