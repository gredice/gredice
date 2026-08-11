'use client';

import { plantFieldStatusLabel } from '@gredice/js/plants';
import { Button } from '@gredice/ui/Button';
import { ArrowLeft, Reset, Sprout } from '@gredice/ui/icons';
import { Spinner } from '@gredice/ui/Spinner';
import { cx } from '@gredice/ui/utils';
import type { Route } from 'next';
import type { OutletOfferData } from '../hooks/useOutletOffers';

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

function plantGroupImageUrl(plantGroup: OutletGardenPlantGroup) {
    for (const sortGroup of plantGroup.sorts) {
        const imageUrl = sortGroupImageUrl(sortGroup);
        if (imageUrl) {
            return imageUrl;
        }
    }

    return null;
}

export type OutletGardenOfferBrowserProps = {
    className?: string;
    isError: boolean;
    isLoading: boolean;
    offers: readonly OutletOfferData[];
    onExit: (destination: 'existing_outlet' | 'garden', href: Route) => void;
    onHoverOffer?: (offerId: number | null) => void;
    onRetry: () => void;
    onSelectOffer: (offerId: number | null) => void;
    selectedOfferId: number | null;
};

export function OutletGardenOfferBrowser({
    className,
    isError,
    isLoading,
    offers,
    onExit,
    onHoverOffer,
    onRetry,
    onSelectOffer,
    selectedOfferId,
}: OutletGardenOfferBrowserProps) {
    const plantGroups = groupOutletGardenOffers(offers);
    const selectedOffer =
        offers.find((offer) => offer.id === selectedOfferId) ?? null;
    const selectedOfferMissing =
        selectedOfferId !== null && !selectedOffer && !isLoading && !isError;
    const state = isLoading
        ? 'loading'
        : isError
          ? 'error'
          : offers.length === 0
            ? 'empty'
            : selectedOfferMissing
              ? 'missing'
              : selectedOffer
                ? 'selected'
                : 'ready';

    return (
        <aside
            aria-labelledby="outlet-garden-offers-title"
            className={cx(
                'relative z-20 flex min-h-0 flex-col overflow-hidden border-t border-white/50 bg-background/95 shadow-2xl backdrop-blur-xl lg:border-t-0 lg:border-l',
                className,
            )}
            data-outlet-garden-browser
            data-outlet-garden-state={state}
        >
            <header className="border-b px-4 py-3 sm:px-5 sm:py-4">
                <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <div className="mb-1 flex items-center gap-2">
                            <span className="rounded-full bg-lime-100 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-lime-900 uppercase dark:bg-lime-950 dark:text-lime-100">
                                3D pregled
                            </span>
                            <span className="text-xs text-muted-foreground">
                                Faza 1
                            </span>
                        </div>
                        <h1
                            className="truncate text-xl font-bold"
                            id="outlet-garden-offers-title"
                        >
                            Outlet vrt
                        </h1>
                    </div>
                    <Button
                        aria-label="Povratak u moj vrt"
                        href="/"
                        onClick={(event) => {
                            event.preventDefault();
                            onExit('garden', '/');
                        }}
                        size="sm"
                        startDecorator={<ArrowLeft className="size-4" />}
                        variant="soft"
                    >
                        Povratak
                    </Button>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                    Razgledaj aktualne ponude. Svaka 3D sadnica predstavlja
                    jednu ponudu, a ne pojedinačni fizički primjerak.
                </p>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5">
                <div aria-live="polite">
                    {isLoading ? (
                        <div
                            className="grid min-h-32 place-items-center gap-2 text-sm text-muted-foreground"
                            data-outlet-garden-loading
                        >
                            <Spinner loadingLabel="Učitavanje outlet ponuda" />
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
                                Pokušaj ponovno bez napuštanja Outlet vrta.
                            </p>
                            <Button
                                className="mt-3"
                                onClick={onRetry}
                                size="sm"
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
                                Vrati se uskoro — Outlet vrt se puni čim nove
                                sadnice postanu dostupne.
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
                                onClick={() => onSelectOffer(null)}
                                size="sm"
                                variant="outlined"
                            >
                                Prikaži dostupne ponude
                            </Button>
                        </div>
                    ) : null}
                </div>

                {offers.length > 0 ? (
                    <section aria-labelledby="outlet-garden-list-title">
                        <h2
                            className="mb-2 text-sm font-semibold"
                            id="outlet-garden-list-title"
                        >
                            Dostupne sadnice ({offers.length})
                        </h2>
                        <div
                            className="space-y-4"
                            data-outlet-garden-offer-list
                        >
                            {plantGroups.map((plantGroup) => {
                                const plantHeadingId = `outlet-garden-${plantGroup.key}-title`;
                                const plantImageUrl =
                                    plantGroupImageUrl(plantGroup);

                                return (
                                    <section
                                        aria-labelledby={plantHeadingId}
                                        className="rounded-xl border bg-muted/30 p-3"
                                        data-outlet-garden-plant-group={
                                            plantGroup.id ?? 'unknown'
                                        }
                                        key={plantGroup.key}
                                    >
                                        <div className="mb-3 flex items-center gap-3">
                                            <div className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-lime-100 text-lime-800 dark:bg-lime-950 dark:text-lime-300">
                                                {plantImageUrl ? (
                                                    // biome-ignore lint/performance/noImgElement: Outlet offer images may use administrator-provided external origins.
                                                    <img
                                                        alt=""
                                                        className="size-full object-cover"
                                                        data-outlet-garden-plant-image
                                                        src={plantImageUrl}
                                                    />
                                                ) : (
                                                    <span
                                                        aria-hidden="true"
                                                        className="grid size-full place-items-center"
                                                        data-outlet-garden-plant-image-fallback
                                                    >
                                                        <Sprout className="size-5" />
                                                    </span>
                                                )}
                                            </div>
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
                                                            <div className="mb-2 flex items-center gap-2">
                                                                <div className="relative size-8 shrink-0 overflow-hidden rounded-md bg-background text-lime-800 shadow-xs ring-1 ring-border dark:text-lime-300">
                                                                    {sortImageUrl ? (
                                                                        // biome-ignore lint/performance/noImgElement: Outlet offer images may use administrator-provided external origins.
                                                                        <img
                                                                            alt=""
                                                                            className="size-full object-cover"
                                                                            data-outlet-garden-sort-image
                                                                            src={
                                                                                sortImageUrl
                                                                            }
                                                                        />
                                                                    ) : (
                                                                        <span
                                                                            aria-hidden="true"
                                                                            className="grid size-full place-items-center"
                                                                            data-outlet-garden-sort-image-fallback
                                                                        >
                                                                            <Sprout className="size-4" />
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <h4
                                                                    className="text-xs font-semibold text-muted-foreground"
                                                                    id={
                                                                        sortHeadingId
                                                                    }
                                                                >
                                                                    {
                                                                        sortGroup.name
                                                                    }
                                                                </h4>
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
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
                                                                                aria-label={`${plantGroup.name}, ${offer.plantSort.name}, sjetva ${shortDateFormatter.format(new Date(offer.sowingDate))}, ${status}, outlet cijena ${currencyFormatter.format(offer.outletPrice)}${comparePriceLabel}, preostalo ${offer.remainingQuantity}`}
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
                                                                                <span className="block truncate text-xs font-medium">
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
                                                                                <span className="mt-1 flex flex-wrap items-end justify-between gap-x-2 text-xs text-muted-foreground">
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

                {selectedOffer ? (
                    <article
                        aria-labelledby="outlet-garden-selected-title"
                        className="mt-4 overflow-hidden rounded-2xl border bg-card shadow-sm"
                        data-outlet-garden-selected-offer={selectedOffer.id}
                    >
                        <div className="relative aspect-[16/9] bg-lime-50 dark:bg-lime-950/30">
                            {offerImageUrl(selectedOffer) ? (
                                // biome-ignore lint/performance/noImgElement: Outlet offer images may use administrator-provided external origins.
                                <img
                                    alt={selectedOffer.plantSort.name}
                                    className="size-full object-cover"
                                    src={offerImageUrl(selectedOffer) ?? ''}
                                />
                            ) : (
                                <div className="grid size-full place-items-center">
                                    <Sprout className="size-12 text-lime-700" />
                                </div>
                            )}
                        </div>
                        <div className="p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <h2
                                        className="text-lg font-bold"
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
                                        Preostalo
                                    </dt>
                                    <dd className="font-medium">
                                        {selectedOffer.remainingQuantity}{' '}
                                        sadnica
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

                            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                                Fotografija može prikazivati konkretnu ponudu
                                ili pripadajuću sortu; 3D model je
                                reprezentativan. Pregled i odabir ovdje ne
                                rezerviraju zalihu.
                            </p>

                            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                                <Button
                                    href={`/?outlet=${selectedOffer.id.toString()}`}
                                    fullWidth
                                    onClick={(event) => {
                                        event.preventDefault();
                                        onExit(
                                            'existing_outlet',
                                            `/?outlet=${selectedOffer.id.toString()}`,
                                        );
                                    }}
                                >
                                    Nastavi u postojećem Outletu
                                </Button>
                                <Button
                                    fullWidth
                                    onClick={() => onSelectOffer(null)}
                                    variant="outlined"
                                >
                                    Zatvori detalje
                                </Button>
                            </div>
                        </div>
                    </article>
                ) : null}
            </div>
        </aside>
    );
}
