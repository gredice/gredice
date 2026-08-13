import {
    OutletGardenOfferBrowser,
    type OutletGardenOfferBrowserProps,
} from '@gredice/game/outlet-garden-browser';
import { Button } from '@gredice/ui/Button';
import { useState } from 'react';

type OutletOffer = OutletGardenOfferBrowserProps['offers'][number];
type OutletGardenCommerce = NonNullable<
    OutletGardenOfferBrowserProps['commerce']
>;

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
    commerceUnavailable = false,
    initialSelectedOfferId = null,
    selectionDriven = false,
    state = 'ready',
}: {
    commerceUnavailable?: boolean;
    displayLimited?: boolean;
    initialSelectedOfferId?: number | null;
    selectionDriven?: boolean;
    state?: OutletGardenOfferBrowserStoryState;
}) {
    const [selectedOfferId, setSelectedOfferId] = useState<number | null>(
        initialSelectedOfferId,
    );
    const [hoveredOfferId, setHoveredOfferId] = useState<number | null>(null);
    const [retryCount, setRetryCount] = useState(0);
    const [commerceCloseCount, setCommerceCloseCount] = useState(0);
    const [offerListOpen, setOfferListOpen] = useState(false);
    const browserOpen =
        !selectionDriven || offerListOpen || selectedOfferId !== null;
    const commerce = commerceUnavailable
        ? ({
              cartHref: null,
              close: () => setCommerceCloseCount((count) => count + 1),
              continueToCart: () => undefined,
              enabled: true,
              errorMessage: null,
              fieldTargets: [],
              gardens: [],
              open: () => undefined,
              opened: true,
              raisedBeds: [],
              receipt: null,
              refreshAuthentication: async () => undefined,
              reserve: async () => undefined,
              retryQueries: async () => undefined,
              selectGarden: () => undefined,
              selectRaisedBed: () => undefined,
              selectTarget: () => undefined,
              selectedGardenId: null,
              selectedOffer:
                  outletOffers.find((offer) => offer.id === selectedOfferId) ??
                  null,
              selectedRaisedBedId: null,
              selectedTargetKey: null,
              state: 'unavailable',
              targets: [],
          } satisfies OutletGardenCommerce)
        : undefined;

    return (
        <div className="h-[100dvh] bg-muted">
            {selectionDriven ? (
                <Button
                    aria-controls="outlet-garden-browser"
                    aria-expanded={offerListOpen}
                    onClick={() => {
                        setSelectedOfferId(null);
                        setOfferListOpen(true);
                    }}
                    variant="outlined"
                >
                    Popis ponuda
                </Button>
            ) : null}
            {browserOpen ? (
                <OutletGardenOfferBrowser
                    className="h-full w-full max-w-md"
                    commerce={commerce}
                    displayLimited={displayLimited}
                    isError={state === 'error'}
                    isLoading={state === 'loading'}
                    offers={state === 'ready' ? outletOffers : []}
                    onClose={
                        selectionDriven
                            ? () => {
                                  setSelectedOfferId(null);
                                  setOfferListOpen(false);
                              }
                            : undefined
                    }
                    onExit={() => undefined}
                    onHoverOffer={setHoveredOfferId}
                    onRetry={() => setRetryCount((count) => count + 1)}
                    onSelectOffer={(offerId) => {
                        setSelectedOfferId(offerId);
                        if (selectionDriven) {
                            setOfferListOpen(false);
                        }
                    }}
                    onShowOfferList={
                        selectionDriven
                            ? () => {
                                  setSelectedOfferId(null);
                                  setOfferListOpen(true);
                              }
                            : undefined
                    }
                    selectedOfferId={selectedOfferId}
                    view={
                        selectionDriven
                            ? offerListOpen
                                ? 'list'
                                : 'details'
                            : 'combined'
                    }
                />
            ) : null}
            <output className="sr-only" data-retry-count>
                {retryCount}
            </output>
            <output className="sr-only" data-hovered-offer-id>
                {hoveredOfferId ?? 'none'}
            </output>
            <output className="sr-only" data-commerce-close-count>
                {commerceCloseCount}
            </output>
            <output className="sr-only" data-selected-offer-id>
                {selectedOfferId ?? 'none'}
            </output>
        </div>
    );
}
