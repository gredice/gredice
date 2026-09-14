import type { HTMLAttributes } from 'react';
import { cx } from '../utils';

export function MarkdownTable({
    className,
    ...props
}: HTMLAttributes<HTMLTableElement>) {
    return (
        <section
            aria-label="Tablica"
            // biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users need to scroll wide tables.
            tabIndex={0}
            className="my-6 max-w-full overflow-x-auto rounded-md border border-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&_table]:my-0"
        >
            <table
                className={cx(
                    'w-full min-w-[32rem] [&_th]:bg-muted/50 [&_th]:px-4 [&_th]:py-3 [&_th]:text-primary [&_td]:px-4 [&_td]:py-3 [&_tr]:border-border [&_thead]:border-border',
                    className,
                )}
                {...props}
            />
        </section>
    );
}
