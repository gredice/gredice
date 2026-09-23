import { useLayoutEffect, useRef } from 'react';

/** Animate the existing photo and review into place without remounting either. */
export function useRaisedBedReviewLayout(compact: boolean, open: boolean) {
    const layoutRef = useRef<HTMLDivElement>(null);
    const previousRects = useRef<Map<HTMLElement, DOMRect> | null>(null);

    function captureScanningLayout() {
        const layout = layoutRef.current;
        if (
            layout?.dataset.reviewLayout !== 'scanning' ||
            previousRects.current
        ) {
            return;
        }

        previousRects.current = new Map(
            Array.from(
                layout.querySelectorAll<HTMLElement>(
                    '[data-review-layout-part]',
                ),
                (element) => [element, element.getBoundingClientRect()],
            ),
        );
    }

    useLayoutEffect(() => {
        const rects = previousRects.current;
        previousRects.current = null;
        if (
            !open ||
            !compact ||
            !rects ||
            window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ) {
            return;
        }

        const animations: Animation[] = [];
        for (const [element, before] of rects) {
            const after = element.getBoundingClientRect();
            if (!element.isConnected || !after.width || !after.height) continue;

            const animation = element.animate(
                [
                    {
                        transformOrigin: 'top left',
                        transform: `translate(${before.left - after.left}px, ${before.top - after.top}px) scale(${before.width / after.width}, ${before.height / after.height})`,
                    },
                    { transformOrigin: 'top left', transform: 'none' },
                ],
                { duration: 300, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
            );
            animation.id = 'raised-bed-review-layout';
            animations.push(animation);
        }

        return () => {
            for (const animation of animations) animation.cancel();
        };
    }, [compact, open]);

    return { captureScanningLayout, layoutRef };
}
