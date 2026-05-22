import type { PropsWithChildren } from 'react';

export type GentleSlideProps = PropsWithChildren<{
    appear: boolean;
    index?: number;
    appearDelayPerIndex?: number;
    amount?: number;
    duration?: number;
    direction?: 'left' | 'down';
    collapsedWhenHidden?: boolean;
}>;

export function GentleSlide({
    children,
    appear,
    index = 0,
    appearDelayPerIndex = 200,
    amount = 12,
    duration = 1000,
    direction = 'left',
    collapsedWhenHidden,
}: GentleSlideProps) {
    const transform =
        direction === 'left'
            ? `translateX(${amount}px)`
            : `translateY(-${amount}px)`;

    return (
        <div
            style={{
                transition: `opacity ${duration}ms ease-out, transform ${duration}ms ease-out`,
                transitionDelay: `${appearDelayPerIndex * index}ms`,
                opacity: appear ? 1 : 0,
                transform: appear ? 'none' : transform,
                height: !appear && collapsedWhenHidden ? 0 : 'auto',
                width: '100%',
            }}
        >
            {children}
        </div>
    );
}
