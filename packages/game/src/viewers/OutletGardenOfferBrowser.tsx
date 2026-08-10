'use client';

import { plantFieldStatusLabel } from '@gredice/js/plants';
import { Button } from '@gredice/ui/Button';
import { ArrowLeft, Reset, Sprout } from '@gredice/ui/icons';
import { Spinner } from '@gredice/ui/Spinner';
import { cx } from '@gredice/ui/utils';
import type { Route } from 'next';
import Image from 'next/image';
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

function offerImageUrl(offer: OutletOfferData) {
    return offer.imageUrls[0] ?? offer.plantSort.imageUrl;
}

export type OutletGardenOfferBrowserProps = {
    className?: string;
    isError: boolean;
    isLoading: boolean;
    offers: readonly OutletOfferData[];
    onExit: (destination: 'existing_outlet' | 'garden', href: Route) => void;
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
    onRetry,
    onSelectOffer,
    selectedOfferId,
}: OutletGardenOfferBrowserProps) {
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
                            className="grid grid-cols-2 gap-2 lg:grid-cols-1"
                            data-outlet-garden-offer-list
                        >
                            {offers.map((offer) => {
                                const selected = offer.id === selectedOffer?.id;
                                return (
                                    <button
                                        aria-label={`${offer.plantSort.name}, ${currencyFormatter.format(offer.outletPrice)}, preostalo ${offer.remainingQuantity}`}
                                        aria-pressed={selected}
                                        className={cx(
                                            'min-h-11 rounded-xl border bg-card p-3 text-left transition-[border-color,background-color,transform] hover:bg-muted focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-lime-700 active:scale-[0.99] motion-reduce:transition-none',
                                            selected
                                                ? 'border-lime-600 bg-lime-50/70 dark:bg-lime-950/30'
                                                : 'border-border',
                                        )}
                                        data-outlet-garden-offer-id={offer.id}
                                        key={offer.id}
                                        onClick={() => onSelectOffer(offer.id)}
                                        type="button"
                                    >
                                        <span className="block truncate text-sm font-semibold">
                                            {offer.plantSort.name}
                                        </span>
                                        <span className="mt-1 flex flex-wrap items-baseline justify-between gap-x-2 text-xs text-muted-foreground">
                                            <span>
                                                preostalo{' '}
                                                {offer.remainingQuantity}
                                            </span>
                                            <strong className="text-sm text-foreground">
                                                {currencyFormatter.format(
                                                    offer.outletPrice,
                                                )}
                                            </strong>
                                        </span>
                                    </button>
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
                                <Image
                                    alt={selectedOffer.plantSort.name}
                                    className="object-cover"
                                    fill
                                    sizes="(min-width: 1024px) 384px, 100vw"
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
                                        {
                                            plantFieldStatusLabel(
                                                selectedOffer.initialPlantStatus,
                                            ).shortLabel
                                        }
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
                                Fotografija prikazuje stvarnu ponudu; 3D model
                                je reprezentativan. Pregled i odabir ovdje ne
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
