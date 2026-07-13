'use client';

import { Alert } from '@gredice/ui/Alert';
import { Card, CardContent } from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import {
    Map as MapIcon,
    MapPin,
    MyLocation,
    Timer,
    Truck,
    Warning,
} from '@gredice/ui/icons';
import { Typography } from '@gredice/ui/Typography';
import type { DriverTrackingState } from '../hooks/useDriverTracking';
import type { DriverDeliveryDashboard } from '../lib/deliveryDashboardTypes';
import {
    formatDeliveryDateTime,
    formatDistance,
    formatTravelDuration,
} from '../lib/deliveryFormatting';
import { DeliveryAppHeader } from './DeliveryAppHeader';
import { DeliveryBatchCard } from './DeliveryBatchCard';
import { DeliveryMap } from './DeliveryMap';
import { DeliveryStopCard } from './DeliveryStopCard';

function trackingMessage(state: DriverTrackingState) {
    switch (state) {
        case 'active':
            return 'GPS praćenje je aktivno. Korisnici vide tvoju zadnju lokaciju dok je ruta otvorena.';
        case 'requesting':
            return 'Čeka se dopuštenje za GPS lokaciju…';
        case 'denied':
            return 'Dopusti pristup lokaciji u pregledniku kako bi korisnici mogli pratiti dostavu.';
        case 'unavailable':
            return 'Ovaj uređaj ne podržava GPS praćenje u pregledniku.';
        case 'error':
            return 'Lokaciju trenutačno nije moguće poslati. Provjeri vezu i GPS postavke.';
        default:
            return null;
    }
}

export function DriverDashboard({
    dashboard,
    trackingState,
    pendingAction,
    onStartRun,
    onArrive,
    onDeliver,
}: {
    dashboard: DriverDeliveryDashboard;
    trackingState: DriverTrackingState;
    pendingAction: string | null;
    onStartRun: (slotId: number) => void;
    onArrive: (runId: string, stopId: number) => void;
    onDeliver: (runId: string, stopId: number, notes?: string) => void;
}) {
    const run = dashboard.activeRun;
    const locationMessage = trackingMessage(trackingState);

    return (
        <div className="min-h-[100dvh] bg-background">
            <DeliveryAppHeader
                displayName={dashboard.user.displayName}
                role={dashboard.user.role}
            />
            <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-5 sm:py-8">
                <div>
                    <Typography level="h2" semiBold>
                        {run ? 'Aktivna ruta' : 'Preuzimanje uroda'}
                    </Typography>
                    <Typography className="mt-1 text-muted-foreground">
                        {run
                            ? 'Slijedi redoslijed stanica, potvrdi dolazak i nastavi nakon svake dostave.'
                            : 'Odaberi termin. Preuzimanjem se urod označava spremnim i računa optimalna ruta.'}
                    </Typography>
                </div>

                {run ? (
                    <>
                        {locationMessage ? (
                            <Alert
                                color={
                                    trackingState === 'active'
                                        ? 'success'
                                        : trackingState === 'requesting'
                                          ? 'info'
                                          : 'warning'
                                }
                                startDecorator={
                                    trackingState === 'active' ? (
                                        <MyLocation className="size-5" />
                                    ) : (
                                        <Warning className="size-5" />
                                    )
                                }
                            >
                                {locationMessage}
                            </Alert>
                        ) : null}

                        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(19rem,0.8fr)]">
                            <DeliveryMap
                                mapUrl={run.mapUrl}
                                version={
                                    run.location?.recordedAt ??
                                    run.estimatesUpdatedAt
                                }
                                title="Karta aktivne dostavne rute"
                            />
                            <Card>
                                <CardContent
                                    noHeader
                                    className="grid h-full grid-cols-2 gap-3 p-4"
                                >
                                    <div className="rounded-lg bg-muted p-3">
                                        <MapIcon className="mb-2 size-5 text-primary" />
                                        <Typography
                                            level="body3"
                                            className="text-muted-foreground"
                                        >
                                            Ukupno
                                        </Typography>
                                        <Typography level="body1" semiBold>
                                            {formatDistance(
                                                run.totalDistanceMeters,
                                            )}
                                        </Typography>
                                    </div>
                                    <div className="rounded-lg bg-muted p-3">
                                        <Timer className="mb-2 size-5 text-primary" />
                                        <Typography
                                            level="body3"
                                            className="text-muted-foreground"
                                        >
                                            Procjena rute
                                        </Typography>
                                        <Typography level="body1" semiBold>
                                            {formatTravelDuration(
                                                run.totalDurationSeconds,
                                            )}
                                        </Typography>
                                    </div>
                                    <div className="col-span-2 rounded-lg border p-3">
                                        <div className="flex items-center justify-between gap-2">
                                            <Typography
                                                level="body3"
                                                className="text-muted-foreground"
                                            >
                                                Preuzeto
                                            </Typography>
                                            <Chip color="success" size="sm">
                                                {
                                                    run.stops.filter(
                                                        (stop) =>
                                                            stop.statusLabel ===
                                                            'Dostavljeno',
                                                    ).length
                                                }{' '}
                                                / {run.stops.length}
                                            </Chip>
                                        </div>
                                        <Typography
                                            level="body2"
                                            className="mt-1"
                                        >
                                            {formatDeliveryDateTime(
                                                run.startedAt,
                                            )}
                                        </Typography>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <section className="space-y-3">
                            <div className="flex items-center gap-2">
                                <MapPin className="size-5 text-primary" />
                                <Typography level="h3" semiBold>
                                    Stanice rute
                                </Typography>
                            </div>
                            <div className="grid gap-3 lg:grid-cols-2">
                                {run.stops.map((stop) => (
                                    <DeliveryStopCard
                                        key={stop.requestId}
                                        stop={stop}
                                        mode="driver"
                                        pendingAction={
                                            pendingAction?.startsWith(
                                                `${stop.id}:`,
                                            )
                                                ? pendingAction.endsWith(
                                                      ':arrive',
                                                  )
                                                    ? 'arrive'
                                                    : 'deliver'
                                                : null
                                        }
                                        onArrive={() =>
                                            stop.id && onArrive(run.id, stop.id)
                                        }
                                        onDeliver={(notes) =>
                                            stop.id &&
                                            onDeliver(run.id, stop.id, notes)
                                        }
                                    />
                                ))}
                            </div>
                        </section>
                    </>
                ) : (
                    <section className="space-y-3">
                        {dashboard.batches.length > 0 ? (
                            dashboard.batches.map((batch) => (
                                <DeliveryBatchCard
                                    key={batch.slotId}
                                    batch={batch}
                                    loading={
                                        pendingAction ===
                                        `start:${batch.slotId}`
                                    }
                                    disabled={Boolean(pendingAction)}
                                    onStart={() => onStartRun(batch.slotId)}
                                />
                            ))
                        ) : (
                            <Card>
                                <CardContent
                                    noHeader
                                    className="flex flex-col items-center gap-3 p-10 text-center"
                                >
                                    <Truck className="size-10 text-muted-foreground" />
                                    <Typography level="h3" semiBold>
                                        Nema spremnih dostava
                                    </Typography>
                                    <Typography className="max-w-md text-muted-foreground">
                                        Novi termini pojavit će se ovdje kada su
                                        dostave potvrđene ili u pripremi.
                                    </Typography>
                                </CardContent>
                            </Card>
                        )}
                    </section>
                )}
            </main>
        </div>
    );
}
