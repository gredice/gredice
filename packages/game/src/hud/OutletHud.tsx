import { IconButton } from '@gredice/ui/IconButton';
import { Discount } from '@gredice/ui/icons';
import { cx } from '@gredice/ui/utils';
import { useMemo } from 'react';
import { useGameAnalytics } from '../analytics/GameAnalyticsContext';
import { useOutletOffers } from '../hooks/useOutletOffers';
import { HudCard } from './components/HudCard';

export function OutletHud() {
    const { data: offers, isLoading } = useOutletOffers();
    const { track } = useGameAnalytics();
    const availableItemsCount = useMemo(
        () =>
            offers?.reduce(
                (total, offer) => total + offer.remainingQuantity,
                0,
            ) ?? 0,
        [offers],
    );

    if (!isLoading && (!offers || offers.length === 0)) {
        return null;
    }

    return (
        <HudCard open position="floating" className="static p-0.5">
            <IconButton
                aria-label="Outlet sadnica"
                title="Outlet sadnica"
                variant="plain"
                className="size-10 rounded-full"
                href="/outlet"
                onClick={() =>
                    track('game_outlet_garden_entry_clicked', {
                        outlet_offer_count: offers?.length ?? 0,
                    })
                }
            >
                <div className="relative flex items-center justify-center">
                    <Discount className="size-6" />
                    {availableItemsCount > 0 ? (
                        <div
                            aria-hidden="true"
                            className={cx(
                                'absolute -top-4 -right-4 flex size-6 items-center justify-center rounded-full border border-tertiary-foreground/30 bg-tertiary px-1.5 text-sm font-semibold leading-none text-tertiary-foreground shadow-md',
                                availableItemsCount > 99 && 'text-[10px]',
                            )}
                            data-outlet-availability-badge
                        >
                            {availableItemsCount > 99
                                ? '99+'
                                : availableItemsCount}
                        </div>
                    ) : null}
                </div>
            </IconButton>
        </HudCard>
    );
}
