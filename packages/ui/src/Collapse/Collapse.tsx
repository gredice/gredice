import type { PropsWithChildren } from 'react';
import { cx } from '../utils';

export type CollapseProps = PropsWithChildren<{
    appear: boolean;
    duration?: number;
}>;

export function Collapse({ appear, children, duration = 200 }: CollapseProps) {
    return (
        <div
            className={cx(
                'grid overflow-hidden transition-[grid-template-rows,opacity]',
                appear
                    ? 'grid-rows-[1fr] opacity-100'
                    : 'grid-rows-[0fr] opacity-0',
            )}
            style={{ transitionDuration: `${duration}ms` }}
        >
            <div className="min-h-0">{children}</div>
        </div>
    );
}
