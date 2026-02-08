import { cx } from '@signalco/ui-primitives/cx';
import type { HTMLAttributes } from 'react';
import './StyledHtml.css';

export function StyledHtml({
    children,
    className,
    ...rest
}: HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cx(
                'max-w-none',
                'prose prose-p:my-2 prose-sm prose-headings:font-normal prose-hr:my-6',
                'text-primary prose-headings:text-primary',
                'prose-a:text-primary',
                className,
            )}
            {...rest}
        >
            {children}
        </div>
    );
}
