import { IconButton } from '@gredice/ui/IconButton';
import { cx } from '@gredice/ui/utils';
import Image from 'next/image';
import { useMemo } from 'react';
import { useGameAnalytics } from '../analytics/GameAnalyticsContext';
import { useOutletOffers } from '../hooks/useOutletOffers';
import { HudCard } from './components/HudCard';
import { HudListItemPresence } from './components/HudListItemPresence';

const outletIconSrc = '/assets/hud/outlet-seedling-price-tag.webp';

export function OutletHud({
    className,
    enabled = true,
}: {
    className?: string;
    enabled?: boolean;
} = {}) {
    const { data: offers, isPending } = useOutletOffers({ enabled });
    const { track } = useGameAnalytics();
    const availableItemsCount = useMemo(
        () =>
            offers?.reduce(
                (total, offer) => total + offer.remainingQuantity,
                0,
            ) ?? 0,
        [offers],
    );

    const visible = enabled && !isPending && Boolean(offers?.length);

    return (
        <HudListItemPresence className={className} visible={visible}>
            <HudCard
                open
                position="floating"
                className="static size-12 p-0.5"
                data-outlet-hud-shell="true"
            >
                <IconButton
                    aria-label="Outlet sadnica"
                    title="Outlet sadnica"
                    variant="plain"
                    className="relative size-10 overflow-visible rounded-full"
                    href="/outlet"
                    onClick={() =>
                        track('game_outlet_garden_entry_clicked', {
                            outlet_offer_count: offers?.length ?? 0,
                        })
                    }
                >
                    <Image
                        alt=""
                        aria-hidden="true"
                        className="pointer-events-none absolute left-1/2 top-0 h-auto w-12 max-w-none -translate-x-1/2 -translate-y-2.5 object-contain drop-shadow-[0_2px_3px_rgb(15_23_42_/_0.35)]"
                        data-outlet-trigger-icon="true"
                        height={44}
                        loading="eager"
                        src={outletIconSrc}
                        unoptimized
                        width={48}
                    />
                    {availableItemsCount > 0 ? (
                        <div
                            aria-hidden="true"
                            className={cx(
                                'pointer-events-none absolute -top-4 -right-4 z-20 flex size-6 items-center justify-center rounded-full border border-tertiary-foreground/30 bg-tertiary px-1.5 text-sm font-semibold leading-none text-tertiary-foreground shadow-md',
                                availableItemsCount > 99 && 'text-[10px]',
                            )}
                            data-outlet-availability-badge
                        >
                            {availableItemsCount > 99
                                ? '99+'
                                : availableItemsCount}
                        </div>
                    ) : null}
                </IconButton>
            </HudCard>
        </HudListItemPresence>
    );
}
