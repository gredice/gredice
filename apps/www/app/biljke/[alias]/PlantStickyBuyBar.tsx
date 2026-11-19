'use client';

import { NavigatingButton } from '@gredice/ui/NavigatingButton';
import { cx } from '@gredice/ui/utils';
import { useEffect, useState } from 'react';
import { formatPrice } from '../../../lib/formatPrice';
import {
    type PlantSowingOfferData,
    plantSowingOfferElementId,
} from './plantSowingOfferData';

/**
 * Keeps the price and the planting button reachable on phones while reading
 * the long plant page. It sticks to the bottom of the page content, so it
 * stops before the footer, and stays out of the way while the header's own
 * offer is on screen.
 */
export function PlantStickyBuyBar({
    href,
    price,
    plantName,
}: Pick<PlantSowingOfferData, 'href' | 'price'> & { plantName: string }) {
    const [offerOutOfView, setOfferOutOfView] = useState(false);

    useEffect(() => {
        const offer = document.getElementById(plantSowingOfferElementId);
        if (!offer || typeof IntersectionObserver === 'undefined') {
            return;
        }

        const observer = new IntersectionObserver(([entry]) => {
            if (entry) {
                setOfferOutOfView(!entry.isIntersecting);
            }
        });
        observer.observe(offer);
        return () => observer.disconnect();
    }, []);

    return (
        <div
            data-plant-sticky-buy-bar=""
            // Hidden from everyone until the header offer leaves the screen.
            inert={!offerOutOfView}
            aria-hidden={!offerOutOfView}
            className={cx(
                'sticky bottom-0 z-30 -mx-4 mt-6 border-t bg-background/95 px-4 pt-2 backdrop-blur-sm transition-[opacity,translate] duration-200 [padding-bottom:calc(0.5rem+env(safe-area-inset-bottom,0px))] motion-reduce:transition-none md:hidden',
                offerOutOfView
                    ? 'translate-y-0 opacity-100'
                    : 'pointer-events-none translate-y-2 opacity-0',
            )}
        >
            <div className="flex items-center justify-between gap-3">
                <p className="min-w-0">
                    <span className="block truncate text-xs text-muted-foreground">
                        {plantName}
                    </span>
                    {price !== null ? (
                        <span className="block text-lg font-semibold leading-tight tabular-nums">
                            {formatPrice(price)}
                        </span>
                    ) : null}
                </p>
                <NavigatingButton
                    href={href}
                    color="brand"
                    className="shrink-0"
                    tabIndex={offerOutOfView ? undefined : -1}
                >
                    Posadi u svoj vrt
                </NavigatingButton>
            </div>
        </div>
    );
}
