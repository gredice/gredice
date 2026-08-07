import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { Card, CardContent } from '@gredice/ui/Card';
import {
    History,
    Hourglass,
    ShoppingCart,
    Truck,
    Warning,
} from '@gredice/ui/icons';
import { Typography } from '@gredice/ui/Typography';
import {
    type ReactNode,
    type Ref,
    useEffect,
    useId,
    useRef,
    useState,
} from 'react';
import {
    customerDeliveryInitialHistoryCount,
    organizeCustomerDeliverySections,
    selectCustomerDeliveryDeepLink,
} from '../lib/customerDeliverySections';
import type {
    CustomerDeliveryDashboard,
    CustomerDeliveryDashboardRequest,
    CustomerDeliveryRequestSummary,
} from '../lib/deliveryDashboardTypes';
import {
    type DeliveryDeepLinkTarget,
    deliveryDeepLinkUnavailableMessage,
} from '../lib/deliveryDeepLink';
import {
    CustomerDashboardFreshness,
    type CustomerDashboardFreshnessFailure,
} from './CustomerDashboardFreshness';
import { CustomerDeliveryCard } from './CustomerDeliveryCard';
import {
    CustomerDeliveryTracking,
    type CustomerDeliveryTrackingRequestTiming,
} from './CustomerDeliveryTracking';
import { CustomerPickupCard } from './CustomerPickupCard';
import { DeliveryAppHeader } from './DeliveryAppHeader';

function CustomerRequestCard({
    request,
    emphasized = false,
    announceArrival = false,
}: {
    request: CustomerDeliveryDashboardRequest;
    emphasized?: boolean;
    announceArrival?: boolean;
}) {
    return request.mode === 'delivery' ? (
        <CustomerDeliveryCard
            announceArrival={announceArrival}
            delivery={request}
            emphasized={emphasized}
            headingLevel="h4"
        />
    ) : (
        <CustomerPickupCard pickup={request} headingLevel="h4" />
    );
}

const deepLinkTargetClassName =
    'scroll-mt-24 rounded-xl ring-2 ring-primary ring-offset-4 ring-offset-background';

function CustomerRequestArticle({
    children,
    className,
    focusLabel,
    focusRef,
    isDeepLinkTarget,
    requestLabel,
    targetRef,
}: {
    children: ReactNode;
    className?: string;
    focusLabel?: string;
    focusRef?: Ref<HTMLElement>;
    isDeepLinkTarget: boolean;
    requestLabel: string;
    targetRef: Ref<HTMLElement>;
}) {
    const accessibleLabelId = useId();
    const resolvedClassName = [
        className,
        isDeepLinkTarget ? deepLinkTargetClassName : undefined,
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <article
            ref={isDeepLinkTarget ? targetRef : focusRef}
            aria-current={isDeepLinkTarget ? 'true' : undefined}
            aria-labelledby={accessibleLabelId}
            className={resolvedClassName || undefined}
            data-testid={
                isDeepLinkTarget
                    ? 'customer-delivery-deep-link-target'
                    : undefined
            }
            tabIndex={isDeepLinkTarget || focusRef ? -1 : undefined}
        >
            <span id={accessibleLabelId} className="sr-only">
                {focusLabel ?? requestLabel}
            </span>
            {children}
        </article>
    );
}

function customerRequestAccessibleLabel(
    request: CustomerDeliveryDashboardRequest,
) {
    const requestKind = request.mode === 'delivery' ? 'Dostava' : 'Preuzimanje';
    return `${requestKind}: ${request.harvest.plantName}`;
}

function CustomerSectionEmpty({ children }: { children: string }) {
    return (
        <div
            data-testid="customer-section-empty"
            className="rounded-lg border border-dashed bg-background/70 px-4 py-5"
        >
            <Typography level="body3" className="text-muted-foreground">
                {children}
            </Typography>
        </div>
    );
}

export function CustomerDashboard({
    dashboard,
    requestTiming,
    freshness,
    deliveryTarget = { kind: 'none' },
}: {
    dashboard: CustomerDeliveryDashboard;
    requestTiming: CustomerDeliveryTrackingRequestTiming | null;
    freshness?: {
        failure: CustomerDashboardFreshnessFailure;
        onRetry: () => Promise<boolean>;
    };
    deliveryTarget?: DeliveryDeepLinkTarget;
}) {
    const hasDelivery = dashboard.deliveries.some(
        (request) => request.mode === 'delivery',
    );
    const hasPickup = dashboard.deliveries.some(
        (request) => request.mode === 'pickup',
    );
    const sections = organizeCustomerDeliverySections(dashboard.deliveries);
    const deepLinkSelection = selectCustomerDeliveryDeepLink(
        sections,
        deliveryTarget,
    );
    const deepLinkRequestId =
        deepLinkSelection.kind === 'selected'
            ? deepLinkSelection.request.requestId
            : null;
    const deepLinkHistoryIndex =
        deepLinkSelection.kind === 'selected' &&
        deepLinkSelection.section === 'history'
            ? deepLinkSelection.index
            : null;
    const hasActiveDelivery = sections.active.length > 0;
    const selectedActiveDelivery =
        deepLinkSelection.kind === 'selected' &&
        deepLinkSelection.section === 'active' &&
        deepLinkSelection.request.mode === 'delivery' &&
        deepLinkSelection.request.mapPath &&
        deepLinkSelection.request.tracking
            ? deepLinkSelection.request
            : null;
    const trackedDelivery =
        selectedActiveDelivery ??
        sections.active.find(
            (request): request is CustomerDeliveryRequestSummary =>
                Boolean(request.mapPath) && Boolean(request.tracking),
        );
    const [visibleHistoryCount, setVisibleHistoryCount] = useState(
        customerDeliveryInitialHistoryCount,
    );
    const [historyFocusIndex, setHistoryFocusIndex] = useState<number | null>(
        null,
    );
    const [historyAnnouncement, setHistoryAnnouncement] = useState('');
    const revealedHistoryRef = useRef<HTMLElement>(null);
    const deepLinkTargetRef = useRef<HTMLElement>(null);
    const focusedDeepLinkRequestIdRef = useRef<string | null>(null);
    const activeHeadingId = useId();
    const upcomingHeadingId = useId();
    const historyHeadingId = useId();
    const historyListId = useId();
    const visibleHistory = sections.history.slice(0, visibleHistoryCount);
    const hiddenHistoryCount = Math.max(
        sections.history.length - visibleHistory.length,
        0,
    );
    const historyCanCollapse =
        visibleHistory.length > customerDeliveryInitialHistoryCount;
    useEffect(() => {
        if (deepLinkHistoryIndex === null) return;
        setVisibleHistoryCount((current) =>
            Math.max(current, deepLinkHistoryIndex + 1),
        );
    }, [deepLinkHistoryIndex]);
    useEffect(() => {
        if (
            !deepLinkRequestId ||
            focusedDeepLinkRequestIdRef.current === deepLinkRequestId ||
            (deepLinkHistoryIndex !== null &&
                visibleHistoryCount <= deepLinkHistoryIndex)
        ) {
            return;
        }
        const target = deepLinkTargetRef.current;
        if (!target) return;
        target.focus({ preventScroll: true });
        target.scrollIntoView({ block: 'center' });
        focusedDeepLinkRequestIdRef.current = deepLinkRequestId;
    }, [deepLinkHistoryIndex, deepLinkRequestId, visibleHistoryCount]);
    useEffect(() => {
        if (historyFocusIndex === null) return;
        revealedHistoryRef.current?.focus();
    }, [historyFocusIndex]);
    const revealMoreHistory = () => {
        const nextCount = Math.min(
            visibleHistoryCount + customerDeliveryInitialHistoryCount,
            sections.history.length,
        );
        setHistoryFocusIndex(visibleHistory.length);
        setVisibleHistoryCount(nextCount);
        setHistoryAnnouncement(
            `Prikazano ${nextCount} od ${sections.history.length} stavki povijesti.`,
        );
    };
    const collapseHistory = () => {
        setVisibleHistoryCount(customerDeliveryInitialHistoryCount);
        setHistoryFocusIndex(null);
        setHistoryAnnouncement(
            `Povijest je sažeta. Prikazano ${customerDeliveryInitialHistoryCount} od ${sections.history.length}.`,
        );
    };
    const heading = hasDelivery
        ? hasPickup
            ? 'Moje dostave i preuzimanja'
            : 'Moje dostave'
        : hasPickup
          ? 'Moja preuzimanja'
          : 'Moje dostave i preuzimanja';
    const headerContext = hasDelivery
        ? hasPickup
            ? 'mixed'
            : 'delivery'
        : hasPickup
          ? 'pickup'
          : 'mixed';
    const description =
        !hasDelivery && !hasPickup
            ? 'Statusi uroda i planirani termini dostava i preuzimanja na jednom mjestu.'
            : hasDelivery
              ? hasPickup
                  ? hasActiveDelivery
                      ? 'Statusi uroda, planirani termini, lokacije preuzimanja i praćenje aktivne dostave na jednom mjestu.'
                      : 'Statusi uroda, planirani termini, lokacije preuzimanja i povijest na jednom mjestu.'
                  : hasActiveDelivery
                    ? 'Statusi uroda, planirani termini i praćenje aktivne dostave na jednom mjestu.'
                    : 'Statusi uroda, planirani termini i povijest dostava na jednom mjestu.'
              : 'Statusi uroda, lokacije i planirani termini preuzimanja na jednom mjestu.';

    return (
        <div className="min-h-[100dvh] bg-background">
            <DeliveryAppHeader
                userId={dashboard.user.id}
                displayName={dashboard.user.displayName}
                role={dashboard.user.role}
                context={headerContext}
            />
            <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-5 sm:py-8">
                {freshness ? (
                    <CustomerDashboardFreshness
                        failure={freshness.failure}
                        refreshedAt={dashboard.refreshedAt}
                        onRetry={freshness.onRetry}
                    />
                ) : null}
                {deepLinkSelection.kind === 'unavailable' ? (
                    <Alert
                        color="warning"
                        data-testid="customer-delivery-deep-link-unavailable"
                        startDecorator={<Warning className="size-5" />}
                    >
                        {deliveryDeepLinkUnavailableMessage}
                    </Alert>
                ) : null}
                <div>
                    <Typography level="h2" semiBold>
                        {heading}
                    </Typography>
                    <Typography className="mt-1 text-muted-foreground">
                        {description}
                    </Typography>
                </div>

                {dashboard.deliveries.length > 0 ? (
                    <div className="space-y-6">
                        {hasDelivery ? (
                            <section
                                aria-labelledby={activeHeadingId}
                                data-testid="customer-active-section"
                                className="space-y-4 rounded-xl border border-primary/20 bg-primary/5 p-4 sm:p-5"
                            >
                                <div className="flex items-start gap-3">
                                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                                        <Truck className="size-5" />
                                    </div>
                                    <div>
                                        <Typography
                                            id={activeHeadingId}
                                            component="h3"
                                            level="h4"
                                            semiBold
                                        >
                                            Aktivna dostava
                                        </Typography>
                                        <Typography
                                            level="body3"
                                            className="mt-1 text-muted-foreground"
                                        >
                                            Najvažniji status, procjena i
                                            praćenje trenutačne rute.
                                        </Typography>
                                    </div>
                                </div>

                                {sections.active.length > 0 ? (
                                    <>
                                        {trackedDelivery?.mapPath &&
                                        trackedDelivery.tracking ? (
                                            <CustomerDeliveryTracking
                                                mapPath={
                                                    trackedDelivery.mapPath
                                                }
                                                tracking={
                                                    trackedDelivery.tracking
                                                }
                                                requestTiming={requestTiming}
                                            />
                                        ) : null}
                                        <div className="grid gap-3 lg:grid-cols-2">
                                            {sections.active.map(
                                                (request, index) => {
                                                    const isDeepLinkTarget =
                                                        request.requestId ===
                                                        deepLinkRequestId;
                                                    return (
                                                        <CustomerRequestArticle
                                                            key={
                                                                request.requestId
                                                            }
                                                            className={
                                                                index === 0
                                                                    ? 'lg:col-span-2'
                                                                    : undefined
                                                            }
                                                            isDeepLinkTarget={
                                                                isDeepLinkTarget
                                                            }
                                                            requestLabel={customerRequestAccessibleLabel(
                                                                request,
                                                            )}
                                                            targetRef={
                                                                deepLinkTargetRef
                                                            }
                                                        >
                                                            <CustomerRequestCard
                                                                announceArrival={
                                                                    index === 0
                                                                }
                                                                request={
                                                                    request
                                                                }
                                                                emphasized={
                                                                    index === 0
                                                                }
                                                            />
                                                        </CustomerRequestArticle>
                                                    );
                                                },
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <CustomerSectionEmpty>
                                        Trenutačno nema dostave na putu.
                                    </CustomerSectionEmpty>
                                )}
                            </section>
                        ) : null}

                        <section
                            aria-labelledby={upcomingHeadingId}
                            data-testid="customer-upcoming-section"
                            className="space-y-3"
                        >
                            <div className="flex items-center gap-2">
                                <Hourglass className="size-5 text-muted-foreground" />
                                <Typography
                                    id={upcomingHeadingId}
                                    component="h3"
                                    level="h4"
                                    semiBold
                                >
                                    Nadolazeće i potrebne radnje
                                </Typography>
                            </div>
                            {sections.upcoming.length > 0 ? (
                                <div className="grid gap-3 lg:grid-cols-2">
                                    {sections.upcoming.map((request) => {
                                        const isDeepLinkTarget =
                                            request.requestId ===
                                            deepLinkRequestId;
                                        return (
                                            <CustomerRequestArticle
                                                key={request.requestId}
                                                isDeepLinkTarget={
                                                    isDeepLinkTarget
                                                }
                                                requestLabel={customerRequestAccessibleLabel(
                                                    request,
                                                )}
                                                targetRef={deepLinkTargetRef}
                                            >
                                                <CustomerRequestCard
                                                    request={request}
                                                />
                                            </CustomerRequestArticle>
                                        );
                                    })}
                                </div>
                            ) : (
                                <CustomerSectionEmpty>
                                    Nema nadolazećih termina ni radnji.
                                </CustomerSectionEmpty>
                            )}
                        </section>

                        <section
                            aria-labelledby={historyHeadingId}
                            data-testid="customer-history-section"
                            className="space-y-3"
                        >
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                    <History className="size-5 text-muted-foreground" />
                                    <Typography
                                        id={historyHeadingId}
                                        component="h3"
                                        level="h4"
                                        semiBold
                                    >
                                        Povijest
                                    </Typography>
                                </div>
                                {sections.history.length > 0 ? (
                                    <Typography
                                        level="body3"
                                        className="shrink-0 text-muted-foreground"
                                    >
                                        {visibleHistory.length} od{' '}
                                        {sections.history.length}
                                    </Typography>
                                ) : null}
                            </div>
                            {sections.history.length > 0 ? (
                                <>
                                    <div
                                        id={historyListId}
                                        className="grid gap-3 lg:grid-cols-2"
                                    >
                                        {visibleHistory.map(
                                            (request, index) => {
                                                const isFirstRevealed =
                                                    index === historyFocusIndex;
                                                const isDeepLinkTarget =
                                                    request.requestId ===
                                                    deepLinkRequestId;
                                                return (
                                                    <CustomerRequestArticle
                                                        key={request.requestId}
                                                        focusLabel={
                                                            isFirstRevealed
                                                                ? `Nova stavka povijesti: ${request.harvest.plantName}`
                                                                : undefined
                                                        }
                                                        focusRef={
                                                            isFirstRevealed
                                                                ? revealedHistoryRef
                                                                : undefined
                                                        }
                                                        isDeepLinkTarget={
                                                            isDeepLinkTarget
                                                        }
                                                        requestLabel={customerRequestAccessibleLabel(
                                                            request,
                                                        )}
                                                        targetRef={
                                                            deepLinkTargetRef
                                                        }
                                                    >
                                                        <CustomerRequestCard
                                                            request={request}
                                                        />
                                                    </CustomerRequestArticle>
                                                );
                                            },
                                        )}
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {historyCanCollapse &&
                                        hiddenHistoryCount > 0 ? (
                                            <Button
                                                aria-controls={historyListId}
                                                onClick={revealMoreHistory}
                                                variant="outlined"
                                                className="min-h-11"
                                            >
                                                {`Prikaži još (${hiddenHistoryCount})`}
                                            </Button>
                                        ) : null}
                                        {sections.history.length >
                                        customerDeliveryInitialHistoryCount ? (
                                            <Button
                                                aria-controls={historyListId}
                                                onClick={
                                                    historyCanCollapse
                                                        ? collapseHistory
                                                        : revealMoreHistory
                                                }
                                                variant={
                                                    historyCanCollapse
                                                        ? 'plain'
                                                        : 'outlined'
                                                }
                                                className="min-h-11"
                                            >
                                                {historyCanCollapse
                                                    ? 'Prikaži manje'
                                                    : `Prikaži još (${hiddenHistoryCount})`}
                                            </Button>
                                        ) : null}
                                    </div>
                                    <span
                                        className="sr-only"
                                        role="status"
                                        aria-live="polite"
                                        aria-atomic="true"
                                    >
                                        {historyAnnouncement}
                                    </span>
                                </>
                            ) : (
                                <CustomerSectionEmpty>
                                    Još nema dovršenih zahtjeva.
                                </CustomerSectionEmpty>
                            )}
                        </section>
                    </div>
                ) : (
                    <Card>
                        <CardContent
                            noHeader
                            className="flex flex-col items-center gap-3 p-10 text-center"
                        >
                            <div className="relative">
                                <ShoppingCart className="size-12 text-muted-foreground" />
                                <Truck className="absolute -bottom-1 -right-4 size-7 text-primary" />
                            </div>
                            <Typography level="h3" semiBold>
                                Još nema dostava ni preuzimanja
                            </Typography>
                            <Typography className="max-w-md text-muted-foreground">
                                Kada zatražiš dostavu ili preuzimanje uroda,
                                ovdje ćeš vidjeti termin, status i dostupne
                                informacije o preuzimanju.
                            </Typography>
                        </CardContent>
                    </Card>
                )}
            </main>
        </div>
    );
}
