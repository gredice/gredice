import { cx } from '@signalco/ui-primitives/cx';
import type { HTMLAttributes } from 'react';

export function StyledHtml({
    children,
    className,
    ...rest
}: HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cx(
                'prose prose-p:my-2 prose-sm max-w-none prose-headings:font-normal prose-headings:text-primary prose-hr:my-6 text-primary',
                className,
            )}
            {...rest}
        >
            {children}
        </div>
    );
}