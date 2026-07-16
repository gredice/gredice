import { Card, CardContent } from '@gredice/ui/Card';
import { ShoppingCart, Truck } from '@gredice/ui/icons';
import { Typography } from '@gredice/ui/Typography';
import type {
    CustomerDeliveryDashboard,
    CustomerDeliveryRequestSummary,
} from '../lib/deliveryDashboardTypes';
import { CustomerDeliveryCard } from './CustomerDeliveryCard';
import { CustomerDeliveryTracking } from './CustomerDeliveryTracking';
import { CustomerPickupCard } from './CustomerPickupCard';
import { DeliveryAppHeader } from './DeliveryAppHeader';

export function CustomerDashboard({
    dashboard,
}: {
    dashboard: CustomerDeliveryDashboard;
}) {
    const hasDelivery = dashboard.deliveries.some(
        (request) => request.mode === 'delivery',
    );
    const hasPickup = dashboard.deliveries.some(
        (request) => request.mode === 'pickup',
    );
    const trackedDelivery = dashboard.deliveries.find(
        (request): request is CustomerDeliveryRequestSummary =>
            request.mode === 'delivery' &&
            Boolean(request.mapPath) &&
            Boolean(request.tracking) &&
            request.status !== 'fulfilled',
    );
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
                  ? 'Statusi uroda, planirani termini, lokacije preuzimanja i praćenje aktivne dostave na jednom mjestu.'
                  : 'Statusi uroda, planirani termini i praćenje aktivne dostave na jednom mjestu.'
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
                <div>
                    <Typography level="h2" semiBold>
                        {heading}
                    </Typography>
                    <Typography className="mt-1 text-muted-foreground">
                        {description}
                    </Typography>
                </div>

                {trackedDelivery?.mapPath && trackedDelivery.tracking ? (
                    <CustomerDeliveryTracking
                        mapPath={trackedDelivery.mapPath}
                        tracking={trackedDelivery.tracking}
                    />
                ) : null}

                {dashboard.deliveries.length > 0 ? (
                    <section className="grid gap-3 lg:grid-cols-2">
                        {dashboard.deliveries.map((request) =>
                            request.mode === 'delivery' ? (
                                <CustomerDeliveryCard
                                    key={request.requestId}
                                    delivery={request}
                                />
                            ) : (
                                <CustomerPickupCard
                                    key={request.requestId}
                                    pickup={request}
                                />
                            ),
                        )}
                    </section>
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
