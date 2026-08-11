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
        imageUrls: ['https://manual-images.example/offer-301.svg'],
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
    {
        id: 303,
        plantSort: {
            id: 101,
            name: 'Rajčica mini red cherry',
            description: 'Druga sjetvena serija cherry rajčice.',
            imageUrl: null,
            plant: { id: 1, name: 'Rajčica' },
        },
        sowingDate: '2026-06-04T00:00:00.000Z',
        initialPlantStatus: 'ready',
        imageUrls: [],
        outletPrice: 2.19,
        comparePrice: 3.99,
        quantity: 3,
        remainingQuantity: 1,
        reservedQuantity: 1,
        soldQuantity: 1,
        startAt: '2026-08-10T00:00:00.000Z',
        endAt: '2026-08-19T00:00:00.000Z',
        url: 'https://www.gredice.test/outlet?offer=303',
    },
    {
        id: 304,
        plantSort: {
            id: 103,
            name: 'Rajčica Scatolone',
            description: 'Mesnata rajčica za umake.',
            imageUrl: null,
            plant: { id: 1, name: 'Rajčica' },
        },
        sowingDate: '2026-06-08T00:00:00.000Z',
        initialPlantStatus: 'firstFlowers',
        imageUrls: [],
        outletPrice: 2.29,
        comparePrice: null,
        quantity: 2,
        remainingQuantity: 2,
        reservedQuantity: 0,
        soldQuantity: 0,
        startAt: '2026-08-10T00:00:00.000Z',
        endAt: '2026-08-22T00:00:00.000Z',
        url: 'https://www.gredice.test/outlet?offer=304',
    },
] satisfies OutletOffer[];

export type OutletGardenOfferBrowserStoryState =
    | 'empty'
    | 'error'
    | 'loading'
    | 'ready';

export function OutletGardenOfferBrowserStory({
    displayLimited = false,
    initialSelectedOfferId = null,
    state = 'ready',
}: {
    displayLimited?: boolean;
    initialSelectedOfferId?: number | null;
    state?: OutletGardenOfferBrowserStoryState;
}) {
    const [selectedOfferId, setSelectedOfferId] = useState<number | null>(
        initialSelectedOfferId,
    );
    const [hoveredOfferId, setHoveredOfferId] = useState<number | null>(null);
    const [retryCount, setRetryCount] = useState(0);

    return (
        <div className="h-[100dvh] bg-muted">
            <OutletGardenOfferBrowser
                className="h-full w-full max-w-md"
                displayLimited={displayLimited}
                isError={state === 'error'}
                isLoading={state === 'loading'}
                offers={state === 'ready' ? outletOffers : []}
                onExit={() => undefined}
                onHoverOffer={setHoveredOfferId}
                onRetry={() => setRetryCount((count) => count + 1)}
                onSelectOffer={setSelectedOfferId}
                selectedOfferId={selectedOfferId}
            />
            <output className="sr-only" data-retry-count>
                {retryCount}
            </output>
            <output className="sr-only" data-hovered-offer-id>
                {hoveredOfferId ?? 'none'}
            </output>
        </div>
    );
}
