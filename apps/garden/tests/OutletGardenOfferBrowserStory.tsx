import {
    OutletGardenOfferBrowser,
    type OutletGardenOfferBrowserProps,
} from '@gredice/game/outlet-garden-browser';
import { useState } from 'react';

type OutletOffer = OutletGardenOfferBrowserProps['offers'][number];

const outletOffers = [
    {
        id: 301,
        plantSort: {
            id: 101,
            name: 'Rajčica mini red cherry',
            description: 'Kompaktna cherry rajčica.',
            imageUrl: null,
            plant: { id: 1, name: 'Rajčica' },
        },
        sowingDate: '2026-05-28T00:00:00.000Z',
        initialPlantStatus: 'sprouted',
        imageUrls: ['https://cdn.gredice.com/sunflower-large.svg'],
        outletPrice: 2.49,
        comparePrice: 3.99,
        quantity: 4,
        remainingQuantity: 2,
        reservedQuantity: 1,
        soldQuantity: 1,
        startAt: '2026-08-10T00:00:00.000Z',
        endAt: '2026-08-20T00:00:00.000Z',
        url: 'https://www.gredice.test/outlet?offer=301',
    },
    {
        id: 302,
        plantSort: {
            id: 102,
            name: 'Paprika Zlata Snack',
            description: 'Slatka snack paprika.',
            imageUrl: null,
            plant: { id: 2, name: 'Paprika' },
        },
        sowingDate: '2026-06-12T00:00:00.000Z',
        initialPlantStatus: 'firstFlowers',
        imageUrls: [],
        outletPrice: 1.99,
        comparePrice: 3.49,
        quantity: 5,
        remainingQuantity: 3,
        reservedQuantity: 0,
        soldQuantity: 2,
        startAt: '2026-08-10T00:00:00.000Z',
        endAt: '2026-08-21T00:00:00.000Z',
        url: 'https://www.gredice.test/outlet?offer=302',
    },
] satisfies OutletOffer[];

export type OutletGardenOfferBrowserStoryState =
    | 'empty'
    | 'error'
    | 'loading'
    | 'ready';

export function OutletGardenOfferBrowserStory({
    initialSelectedOfferId = null,
    state = 'ready',
}: {
    initialSelectedOfferId?: number | null;
    state?: OutletGardenOfferBrowserStoryState;
}) {
    const [selectedOfferId, setSelectedOfferId] = useState<number | null>(
        initialSelectedOfferId,
    );
    const [retryCount, setRetryCount] = useState(0);

    return (
        <div className="h-[100dvh] bg-muted">
            <OutletGardenOfferBrowser
                className="h-full w-full max-w-md"
                isError={state === 'error'}
                isLoading={state === 'loading'}
                offers={state === 'ready' ? outletOffers : []}
                onExit={() => undefined}
                onRetry={() => setRetryCount((count) => count + 1)}
                onSelectOffer={setSelectedOfferId}
                selectedOfferId={selectedOfferId}
            />
            <output className="sr-only" data-retry-count>
                {retryCount}
            </output>
        </div>
    );
}
