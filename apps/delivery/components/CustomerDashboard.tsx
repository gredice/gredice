import { Alert } from '@gredice/ui/Alert';
import { Card, CardContent } from '@gredice/ui/Card';
import { MyLocation, ShoppingCart, Truck } from '@gredice/ui/icons';
import { Typography } from '@gredice/ui/Typography';
import type { CustomerDeliveryDashboard } from '../lib/deliveryDashboardTypes';
import { formatDeliveryDateTime } from '../lib/deliveryFormatting';
import { DeliveryAppHeader } from './DeliveryAppHeader';
import { DeliveryMap } from './DeliveryMap';
import { DeliveryStopCard } from './DeliveryStopCard';

export function CustomerDashboard({
    dashboard,
}: {
    dashboard: CustomerDeliveryDashboard;
}) {
    const liveDelivery = dashboard.deliveries.find(
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

                {liveDelivery?.runId && liveDelivery.tracking ? (
                    <section className="space-y-3">
                        <Alert
                            color="info"
                            startDecorator={<MyLocation className="size-5" />}
                        >
                            Vozač je na putu. Zadnja lokacija:{' '}
                            {formatDeliveryDateTime(
                                liveDelivery.tracking.recordedAt,
                            )}
                        </Alert>
                        <DeliveryMap
                            mapUrl={`/api/map/${liveDelivery.runId}`}
                            version={liveDelivery.tracking.recordedAt}
                            title="Trenutna lokacija vozača i moja dostava"
                        />
                    </section>
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
