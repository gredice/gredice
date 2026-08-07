import type {
    CSSProperties,
    PropsWithChildren,
    TransitionEventHandler,
} from 'react';
import { cx } from '../utils';

type CollapseStyle = CSSProperties & {
    '--collapse-duration': string;
};

export type CollapseProps = PropsWithChildren<{
    appear: boolean;
    className?: string;
    duration?: number;
    onTransitionEnd?: TransitionEventHandler<HTMLDivElement>;
}>;

export function Collapse({
    appear,
    children,
    className,
    duration = 200,
    onTransitionEnd,
}: CollapseProps) {
    const style: CollapseStyle = {
        '--collapse-duration': `${duration}ms`,
    };

    return (
        <div
            data-collapse-state={appear ? 'open' : 'closed'}
            className={cx(
                'grid overflow-hidden transition-[grid-template-rows,opacity] [transition-duration:var(--collapse-duration)]',
                appear
                    ? 'grid-rows-[1fr] opacity-100'
                    : 'grid-rows-[0fr] opacity-0',
                className,
            )}
            onTransitionEnd={onTransitionEnd}
            style={style}
        >
            <div className="min-h-0">{children}</div>
        </div>
    );
}
