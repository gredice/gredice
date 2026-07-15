import { Card, CardContent } from '@gredice/ui/Card';
import { ShoppingCart, Truck } from '@gredice/ui/icons';
import { Typography } from '@gredice/ui/Typography';
import type { CustomerDeliveryDashboard } from '../lib/deliveryDashboardTypes';
import { CustomerDeliveryTracking } from './CustomerDeliveryTracking';
import { DeliveryAppHeader } from './DeliveryAppHeader';
import { DeliveryStopCard } from './DeliveryStopCard';

export function CustomerDashboard({
    dashboard,
}: {
    dashboard: CustomerDeliveryDashboard;
}) {
    const trackedDelivery = dashboard.deliveries.find(
        (delivery) =>
            delivery.runId &&
            delivery.tracking &&
            delivery.statusLabel !== 'Dostavljeno',
    );

    return (
        <div className="min-h-[100dvh] bg-background">
            <DeliveryAppHeader
                displayName={dashboard.user.displayName}
                role={dashboard.user.role}
            />
            <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-5 sm:py-8">
                <div>
                    <Typography level="h2" semiBold>
                        Moje dostave
                    </Typography>
                    <Typography className="mt-1 text-muted-foreground">
                        Statusi uroda, planirani termini i praćenje aktivne
                        dostave na jednom mjestu.
                    </Typography>
                </div>

                {trackedDelivery?.runId && trackedDelivery.tracking ? (
                    <CustomerDeliveryTracking
                        runId={trackedDelivery.runId}
                        tracking={trackedDelivery.tracking}
                    />
                ) : null}

                {dashboard.deliveries.length > 0 ? (
                    <section className="grid gap-3 lg:grid-cols-2">
                        {dashboard.deliveries.map((delivery) => (
                            <DeliveryStopCard
                                key={delivery.requestId}
                                stop={delivery}
                                mode="customer"
                            />
                        ))}
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
                                Još nema dostava
                            </Typography>
                            <Typography className="max-w-md text-muted-foreground">
                                Kada zatražiš dostavu uroda, ovdje ćeš vidjeti
                                njezin termin, status i praćenje vozača.
                            </Typography>
                        </CardContent>
                    </Card>
                )}
            </main>
        </div>
    );
}
