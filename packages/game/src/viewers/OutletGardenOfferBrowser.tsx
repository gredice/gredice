'use client';

import { plantFieldStatusLabel } from '@gredice/js/plants';
import { Button } from '@gredice/ui/Button';
import { IconButton } from '@gredice/ui/IconButton';
import { ArrowLeft, Close, Reset, Sprout } from '@gredice/ui/icons';
import { Spinner } from '@gredice/ui/Spinner';
import { cx } from '@gredice/ui/utils';
import type { Route } from 'next';
import { type ReactNode, useEffect, useRef } from 'react';
import type { OutletOfferData } from '../hooks/useOutletOffers';
import {
    type OutletGardenCommerceController,
    OutletGardenReservationPanel,
} from './OutletGardenCommerce';

const currencyFormatter = new Intl.NumberFormat('hr-HR', {
    style: 'currency',
    currency: 'EUR',
});

const dateFormatter = new Intl.DateTimeFormat('hr-HR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
});

const shortDateFormatter = new Intl.DateTimeFormat('hr-HR', {
    day: 'numeric',
    month: 'short',
});

type OutletGardenSortGroup = {
    id: number;
    name: string;
    offers: OutletOfferData[];
};

type OutletGardenPlantGroup = {
    id: number | null;
    key: string;
    name: string;
    sorts: OutletGardenSortGroup[];
};

function compareOutletGardenOffers(
    left: OutletOfferData,
    right: OutletOfferData,
) {
    const leftPlantId = left.plantSort.plant?.id ?? Number.MAX_SAFE_INTEGER;
    const rightPlantId = right.plantSort.plant?.id ?? Number.MAX_SAFE_INTEGER;

    return (
        leftPlantId - rightPlantId ||
        left.plantSort.id - right.plantSort.id ||
        left.sowingDate.localeCompare(right.sowingDate) ||
        left.endAt.localeCompare(right.endAt) ||
        left.id - right.id
    );
}

function groupOutletGardenOffers(offers: readonly OutletOfferData[]) {
    const plantGroups = new Map<string, OutletGardenPlantGroup>();

    for (const offer of [...offers].sort(compareOutletGardenOffers)) {
        const plant = offer.plantSort.plant;
        const plantKey = plant
            ? `plant:${plant.id.toString()}`
            : 'plant:unknown';
        const plantGroup = plantGroups.get(plantKey) ?? {
            id: plant?.id ?? null,
            key: plantKey,
            name: plant?.name ?? 'Ostale sadnice',
            sorts: [],
        };
        let sortGroup = plantGroup.sorts.find(
            (candidate) => candidate.id === offer.plantSort.id,
        );
        if (!sortGroup) {
            sortGroup = {
                id: offer.plantSort.id,
                name: offer.plantSort.name,
                offers: [],
            };
            plantGroup.sorts.push(sortGroup);
        }
        sortGroup.offers.push(offer);
        plantGroups.set(plantKey, plantGroup);
    }

    return Array.from(plantGroups.values());
}

function offerImageUrl(offer: OutletOfferData) {
    return offer.imageUrls[0] ?? offer.plantSort.imageUrl;
}

function outletPlantStatusShortLabel(status: string) {
    return status === 'ready'
        ? 'Spremna za presađivanje'
        : plantFieldStatusLabel(status).shortLabel;
}

function sortGroupImageUrl(sortGroup: OutletGardenSortGroup) {
    for (const offer of sortGroup.offers) {
        if (offer.plantSort.imageUrl) {
            return offer.plantSort.imageUrl;
        }
    }

    for (const offer of sortGroup.offers) {
        const imageUrl = offerImageUrl(offer);
        if (imageUrl) {
            return imageUrl;
        }
    }

    return null;
}

export type OutletGardenOfferBrowserProps = {
    className?: string;
    commerce?: OutletGardenCommerceController;
    headerAction?: ReactNode;
    isError: boolean;
    isLoading: boolean;
    offers: readonly OutletOfferData[];
    onClose?: () => void;
    onExit: (destination: 'existing_outlet' | 'garden', href: Route) => void;
    onHoverOffer?: (offerId: number | null) => void;
    onAuthenticationRequired?: () => void;
    onRetry: () => void;
    onSelectOffer: (offerId: number | null) => void;
    onShowOfferList?: () => void;
    selectedOfferId: number | null;
    surface?: 'modal' | 'panel';
    view?: 'combined' | 'details' | 'list';
};

export function OutletGardenOfferBrowser({
    className,
    commerce,
    headerAction,
    isError,
    isLoading,
    offers,
    onClose,
    onExit,
    onHoverOffer,
    onAuthenticationRequired,
    onRetry,
    onSelectOffer,
    onShowOfferList,
    selectedOfferId,
    surface = 'panel',
    view = 'combined',
}: OutletGardenOfferBrowserProps) {
    const plantGroups = groupOutletGardenOffers(offers);
    const selectedOffer =
        offers.find((offer) => offer.id === selectedOfferId) ??
        (commerce?.receipt?.offer.id === selectedOfferId
            ? commerce.receipt.offer
            : null);
    const selectedOfferMissing =
        selectedOfferId !== null && !selectedOffer && !isLoading && !isError;
    const showOfferList = view !== 'details';
    const showSelectedOffer = view !== 'list';
    const showModalDetails =
        surface === 'modal' && view === 'details' && selectedOffer !== null;
    const selectedOfferIdForFocus = selectedOffer?.id ?? null;
    const state = isLoading
        ? 'loading'
        : isError
          ? 'error'
          : offers.length === 0
            ? 'empty'
            : selectedOfferMissing
              ? 'missing'
              : selectedOffer && showSelectedOffer
                ? 'selected'
                : 'ready';
    const selectedDetailsRef = useRef<HTMLElement>(null);

    useEffect(() => {
        if (view === 'details' && selectedOfferIdForFocus !== null) {
            selectedDetailsRef.current?.focus({ preventScroll: true });
        }
    }, [selectedOfferIdForFocus, view]);

    return (
        <aside
            aria-labelledby={
                showModalDetails
                    ? 'outlet-garden-selected-title'
                    : 'outlet-garden-offers-title'
            }
            className={cx(
                'relative flex min-h-0 flex-col overflow-hidden',
                surface === 'panel'
                    ? 'z-20 border-t border-white/50 bg-background/95 shadow-2xl backdrop-blur-xl lg:border-t-0 lg:border-l'
                    : 'max-h-[calc(100dvh-2rem)] bg-background',
                className,
            )}
            data-outlet-garden-browser
            data-outlet-garden-state={state}
            id="outlet-garden-browser"
        >
            {!showModalDetails ? (
                <header className="border-b px-4 py-3 sm:px-5 sm:py-4">
                    <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                            <h1
                                className="truncate text-xl font-bold"
                                id="outlet-garden-offers-title"
                            >
                                Dostupne sadnice
                            </h1>
                            {view !== 'details' ? (
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Odaberi sadnicu i provjeri detalje ponude.
                                </p>
                            ) : null}
                        </div>
                        {onClose ? (
                            <IconButton
                                aria-label={
                                    view === 'details'
                                        ? 'Zatvori detalje sadnice'
                                        : 'Zatvori popis dostupnih sadnica'
                                }
                                className="shrink-0 rounded-full"
                                onClick={onClose}
                                size="lg"
                                variant="plain"
                            >
                                <Close aria-hidden className="size-4" />
                            </IconButton>
                        ) : (
                            <Button
                                aria-label="Povratak u moj vrt"
                                href="/"
                                onClick={(event) => {
                                    event.preventDefault();
                                    onExit('garden', '/');
                                }}
                                size="lg"
                                startDecorator={
                                    <ArrowLeft className="size-4" />
                                }
                                variant="soft"
                            >
                                Povratak
                            </Button>
                        )}
                    </div>
                    {headerAction ? (
                        <div className="mt-3">{headerAction}</div>
                    ) : null}
                </header>
            ) : null}

            <div
                className={cx(
                    'min-h-0 flex-1 overflow-y-auto overscroll-contain',
                    showModalDetails ? 'p-0' : 'p-4 sm:p-5',
                )}
            >
                <div aria-live="polite">
                    {isLoading ? (
                        <div
                            className="grid min-h-32 place-items-center gap-2 text-sm text-muted-foreground"
                            data-outlet-garden-loading
                        >
                            <Spinner
                                className="motion-reduce:animate-none"
                                loadingLabel="Učitavanje outlet ponuda"
                            />
                            <span>Učitavamo današnje sadnice...</span>
                        </div>
                    ) : null}

                    {isError ? (
                        <div
                            className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm dark:border-red-900 dark:bg-red-950/40"
                            data-outlet-garden-error
                        >
                            <p className="font-semibold">
                                Ponude se trenutačno ne mogu učitati.
                            </p>
                            <p className="mt-1 text-muted-foreground">
                                Pokušaj ponovno bez zatvaranja ovog pregleda.
                            </p>
                            <Button
                                className="mt-3"
                                onClick={onRetry}
                                size="lg"
                                startDecorator={<Reset className="size-4" />}
                                variant="outlined"
                            >
                                Pokušaj ponovno
                            </Button>
                        </div>
                    ) : null}

                    {!isLoading && !isError && offers.length === 0 ? (
                        <div
                            className="grid min-h-32 place-items-center rounded-xl border border-dashed p-5 text-center"
                            data-outlet-garden-empty
                        >
                            <Sprout className="mb-2 size-8 text-lime-700" />
                            <p className="font-semibold">
                                Trenutačno nema aktivnih ponuda.
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Vrati se uskoro — nove sadnice dodajemo čim
                                postanu dostupne.
                            </p>
                        </div>
                    ) : null}

                    {selectedOfferMissing ? (
                        <div
                            className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-900 dark:bg-amber-950/40"
                            data-outlet-garden-missing-offer
                        >
                            <p className="font-semibold">
                                Ova ponuda više nije dostupna.
                            </p>
                            <p className="mt-1 text-muted-foreground">
                                Možda je upravo rasprodana ili je istekla.
                                Odaberi neku od trenutačnih ponuda.
                            </p>
                            <Button
                                className="mt-3"
                                onClick={() => {
                                    if (onShowOfferList) {
                                        onShowOfferList();
                                        return;
                                    }

                                    onSelectOffer(null);
                                }}
                                size="lg"
                                variant="outlined"
                            >
                                Prikaži dostupne ponude
                            </Button>
                        </div>
                    ) : null}
                </div>

                {offers.length > 0 && showOfferList ? (
                    <section aria-labelledby="outlet-garden-list-title">
                        <h2
                            className="mb-2 text-sm font-semibold"
                            id="outlet-garden-list-title"
                        >
                            Dostupne ponude ({offers.length})
                        </h2>
                        <div
                            className="space-y-4"
                            data-outlet-garden-offer-list
                        >
                            {plantGroups.map((plantGroup) => {
                                const plantHeadingId = `outlet-garden-${plantGroup.key}-title`;

                                return (
                                    <section
                                        aria-labelledby={plantHeadingId}
                                        className="rounded-xl border bg-muted/30 p-3"
                                        data-outlet-garden-plant-group={
                                            plantGroup.id ?? 'unknown'
                                        }
                                        key={plantGroup.key}
                                    >
                                        <div className="mb-3">
                                            <h3
                                                className="text-sm font-bold"
                                                id={plantHeadingId}
                                            >
                                                {plantGroup.name}
                                            </h3>
                                        </div>

                                        <div className="space-y-3">
                                            {plantGroup.sorts.map(
                                                (sortGroup) => {
                                                    const sortHeadingId = `outlet-garden-sort-${sortGroup.id.toString()}-title`;
                                                    const sortImageUrl =
                                                        sortGroupImageUrl(
                                                            sortGroup,
                                                        );
                                                    return (
                                                        <section
                                                            aria-labelledby={
                                                                sortHeadingId
                                                            }
                                                            data-outlet-garden-sort-group={
                                                                sortGroup.id
                                                            }
                                                            key={sortGroup.id}
                                                        >
                                                            <h4
                                                                className="sr-only"
                                                                id={
                                                                    sortHeadingId
                                                                }
                                                            >
                                                                {sortGroup.name}
                                                            </h4>
                                                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
                                                                {sortGroup.offers.map(
                                                                    (offer) => {
                                                                        const selected =
                                                                            offer.id ===
                                                                            selectedOffer?.id;
                                                                        const status =
                                                                            outletPlantStatusShortLabel(
                                                                                offer.initialPlantStatus,
                                                                            );
                                                                        const comparePriceLabel =
                                                                            offer.comparePrice !==
                                                                            null
                                                                                ? `, redovna cijena ${currencyFormatter.format(offer.comparePrice)}`
                                                                                : '';
                                                                        return (
                                                                            <button
                                                                                aria-label={`${plantGroup.name}, ${offer.plantSort.name}, sjetva ${shortDateFormatter.format(new Date(offer.sowingDate))}, ${status}, outlet cijena ${currencyFormatter.format(offer.outletPrice)}${comparePriceLabel}, preostalo ${offer.remainingQuantity}, ponuda vrijedi do ${dateFormatter.format(new Date(offer.endAt))}`}
                                                                                aria-pressed={
                                                                                    selected
                                                                                }
                                                                                className={cx(
                                                                                    'min-h-11 rounded-xl border bg-card p-3 text-left transition-[border-color,background-color,transform] hover:bg-muted focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-lime-700 active:scale-[0.99] motion-reduce:transition-none',
                                                                                    selected
                                                                                        ? 'border-lime-600 bg-lime-50/70 dark:bg-lime-950/30'
                                                                                        : 'border-border',
                                                                                )}
                                                                                data-outlet-garden-offer-id={
                                                                                    offer.id
                                                                                }
                                                                                key={
                                                                                    offer.id
                                                                                }
                                                                                onClick={() =>
                                                                                    onSelectOffer(
                                                                                        offer.id,
                                                                                    )
                                                                                }
                                                                                onBlur={() =>
                                                                                    onHoverOffer?.(
                                                                                        null,
                                                                                    )
                                                                                }
                                                                                onFocus={() =>
                                                                                    onHoverOffer?.(
                                                                                        offer.id,
                                                                                    )
                                                                                }
                                                                                onPointerEnter={(
                                                                                    event,
                                                                                ) => {
                                                                                    if (
                                                                                        event.pointerType !==
                                                                                        'touch'
                                                                                    ) {
                                                                                        onHoverOffer?.(
                                                                                            offer.id,
                                                                                        );
                                                                                    }
                                                                                }}
                                                                                onPointerLeave={(
                                                                                    event,
                                                                                ) => {
                                                                                    if (
                                                                                        event.pointerType !==
                                                                                        'touch'
                                                                                    ) {
                                                                                        onHoverOffer?.(
                                                                                            null,
                                                                                        );
                                                                                    }
                                                                                }}
                                                                                type="button"
                                                                            >
                                                                                <span className="flex gap-3">
                                                                                    <span className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-background text-lime-800 shadow-xs ring-1 ring-border dark:text-lime-300">
                                                                                        {sortImageUrl ? (
                                                                                            // biome-ignore lint/performance/noImgElement: Outlet offer images may use administrator-provided external origins.
                                                                                            <img
                                                                                                alt=""
                                                                                                className="size-full object-cover"
                                                                                                data-outlet-garden-offer-image
                                                                                                decoding="async"
                                                                                                loading="lazy"
                                                                                                src={
                                                                                                    sortImageUrl
                                                                                                }
                                                                                            />
                                                                                        ) : (
                                                                                            <span
                                                                                                aria-hidden="true"
                                                                                                className="grid size-full place-items-center"
                                                                                                data-outlet-garden-offer-image-fallback
                                                                                            >
                                                                                                <Sprout className="size-5" />
                                                                                            </span>
                                                                                        )}
                                                                                    </span>
                                                                                    <span className="min-w-0 flex-1">
                                                                                        <span className="block truncate text-sm font-semibold">
                                                                                            {
                                                                                                offer
                                                                                                    .plantSort
                                                                                                    .name
                                                                                            }
                                                                                        </span>
                                                                                        <span className="mt-1 block truncate text-xs font-medium">
                                                                                            Sjetva{' '}
                                                                                            {shortDateFormatter.format(
                                                                                                new Date(
                                                                                                    offer.sowingDate,
                                                                                                ),
                                                                                            )}{' '}
                                                                                            ·{' '}
                                                                                            {
                                                                                                status
                                                                                            }
                                                                                        </span>
                                                                                        <span className="mt-2 flex flex-wrap items-end justify-between gap-x-2 text-xs text-muted-foreground">
                                                                                            <span>
                                                                                                preostalo{' '}
                                                                                                {
                                                                                                    offer.remainingQuantity
                                                                                                }
                                                                                            </span>
                                                                                            <span className="shrink-0 text-right">
                                                                                                <strong className="block text-base leading-tight text-lime-800 dark:text-lime-300">
                                                                                                    {currencyFormatter.format(
                                                                                                        offer.outletPrice,
                                                                                                    )}
                                                                                                </strong>
                                                                                                {offer.comparePrice !==
                                                                                                null ? (
                                                                                                    <del className="block text-[11px] leading-tight text-muted-foreground">
                                                                                                        {currencyFormatter.format(
                                                                                                            offer.comparePrice,
                                                                                                        )}
                                                                                                    </del>
                                                                                                ) : null}
                                                                                            </span>
                                                                                        </span>
                                                                                    </span>
                                                                                </span>
                                                                            </button>
                                                                        );
                                                                    },
                                                                )}
                                                            </div>
                                                        </section>
                                                    );
                                                },
                                            )}
                                        </div>
                                    </section>
                                );
                            })}
                        </div>
                    </section>
                ) : null}

                {selectedOffer && showSelectedOffer ? (
                    <article
                        aria-labelledby="outlet-garden-selected-title"
                        className={cx(
                            'overflow-hidden outline-hidden',
                            showModalDetails
                                ? 'bg-background'
                                : 'rounded-2xl border bg-card shadow-sm',
                            showOfferList ? 'mt-4' : null,
                        )}
                        data-outlet-garden-selected-offer={selectedOffer.id}
                        ref={selectedDetailsRef}
                        tabIndex={-1}
                    >
                        <div
                            className={cx(
                                'relative bg-lime-50 dark:bg-lime-950/30',
                                showModalDetails
                                    ? 'aspect-square'
                                    : 'aspect-[16/9]',
                            )}
                            data-outlet-garden-offer-cover={
                                showModalDetails || undefined
                            }
                        >
                            {offerImageUrl(selectedOffer) ? (
                                // biome-ignore lint/performance/noImgElement: Outlet offer images may use administrator-provided external origins.
                                <img
                                    alt={selectedOffer.plantSort.name}
                                    className="size-full object-cover"
                                    decoding="async"
                                    src={offerImageUrl(selectedOffer) ?? ''}
                                />
                            ) : (
                                <div className="grid size-full place-items-center">
                                    <Sprout className="size-12 text-lime-700" />
                                </div>
                            )}
                            {showModalDetails && onClose ? (
                                <IconButton
                                    aria-label="Zatvori detalje sadnice"
                                    className="absolute top-3 right-3 rounded-full bg-background/90 shadow-md backdrop-blur-sm"
                                    onClick={onClose}
                                    size="lg"
                                    variant="plain"
                                >
                                    <Close aria-hidden className="size-4" />
                                </IconButton>
                            ) : null}
                        </div>
                        <div
                            className={
                                showModalDetails
                                    ? 'p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]'
                                    : 'p-4'
                            }
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <h2
                                        className={cx(
                                            'font-bold',
                                            showModalDetails
                                                ? 'text-2xl'
                                                : 'text-lg',
                                        )}
                                        id="outlet-garden-selected-title"
                                    >
                                        {selectedOffer.plantSort.name}
                                    </h2>
                                    {selectedOffer.plantSort.plant?.name ? (
                                        <p className="text-sm text-muted-foreground">
                                            {selectedOffer.plantSort.plant.name}
                                        </p>
                                    ) : null}
                                </div>
                                <div className="shrink-0 text-right">
                                    <p className="text-xl font-bold text-lime-800 dark:text-lime-300">
                                        {currencyFormatter.format(
                                            selectedOffer.outletPrice,
                                        )}
                                    </p>
                                    {selectedOffer.comparePrice !== null ? (
                                        <p className="text-xs text-muted-foreground line-through">
                                            {currencyFormatter.format(
                                                selectedOffer.comparePrice,
                                            )}
                                        </p>
                                    ) : null}
                                </div>
                            </div>

                            <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-muted/50 p-3 text-sm">
                                <div>
                                    <dt className="text-xs text-muted-foreground">
                                        Sjetva
                                    </dt>
                                    <dd className="font-medium">
                                        {dateFormatter.format(
                                            new Date(selectedOffer.sowingDate),
                                        )}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-xs text-muted-foreground">
                                        {commerce?.receipt?.offer.id ===
                                            selectedOffer.id &&
                                        commerce.state === 'success'
                                            ? 'Rezervirano'
                                            : 'Preostalo'}
                                    </dt>
                                    <dd className="font-medium">
                                        {commerce?.receipt?.offer.id ===
                                            selectedOffer.id &&
                                        commerce.state === 'success'
                                            ? '1 sadnica'
                                            : `${selectedOffer.remainingQuantity.toString()} sadnica`}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-xs text-muted-foreground">
                                        Razvojna faza
                                    </dt>
                                    <dd className="font-medium">
                                        {outletPlantStatusShortLabel(
                                            selectedOffer.initialPlantStatus,
                                        )}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-xs text-muted-foreground">
                                        Ponuda vrijedi do
                                    </dt>
                                    <dd className="font-medium">
                                        {dateFormatter.format(
                                            new Date(selectedOffer.endAt),
                                        )}
                                    </dd>
                                </div>
                            </dl>

                            <p className="mt-3 text-[10px] leading-4 text-muted-foreground/70">
                                Fotografija je reprezentativna. Sadnica se
                                rezervira tek nakon potvrde polja.
                            </p>

                            {commerce ? (
                                <OutletGardenReservationPanel
                                    commerce={commerce}
                                    onAuthenticationRequired={() =>
                                        onAuthenticationRequired?.()
                                    }
                                    onChooseAnother={() => {
                                        commerce.close();
                                        if (onShowOfferList) {
                                            onShowOfferList();
                                            return;
                                        }
                                        onSelectOffer(null);
                                    }}
                                />
                            ) : null}

                            {view === 'details' && onShowOfferList ? (
                                <Button
                                    aria-label="Prikaži popis dostupnih sadnica"
                                    className="mt-4"
                                    fullWidth
                                    onClick={onShowOfferList}
                                    startDecorator={
                                        <ArrowLeft className="size-4" />
                                    }
                                    variant="outlined"
                                >
                                    Sve dostupne sadnice
                                </Button>
                            ) : null}

                            {view === 'combined' ? (
                                <Button
                                    className="mt-4"
                                    fullWidth
                                    onClick={() => onSelectOffer(null)}
                                    variant="outlined"
                                >
                                    Zatvori detalje
                                </Button>
                            ) : null}
                        </div>
                    </article>
                ) : null}
            </div>
        </aside>
    );
}
