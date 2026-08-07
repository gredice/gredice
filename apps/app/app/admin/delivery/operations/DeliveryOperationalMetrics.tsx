import type { DeliveryOperationalHealth } from '@gredice/storage';
import { Card } from '@gredice/ui/Card';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { DeliveryOperationalMetric } from './DeliveryOperationalMetric';
import {
    formatDeliveryOperationalDuration,
    formatDeliveryOperationalPercentage,
} from './deliveryOperationalPresentation';

export function DeliveryOperationalMetrics({
    health,
}: {
    health: DeliveryOperationalHealth;
}) {
    return (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card className="p-4">
                <Stack spacing={3}>
                    <Typography component="h2" level="body1" semiBold>
                        Rute
                    </Typography>
                    <div className="grid grid-cols-3 gap-3">
                        <DeliveryOperationalMetric
                            label="Aktivne"
                            value={health.runs.activeCount}
                        />
                        <DeliveryOperationalMetric
                            label="Završene"
                            value={health.runs.completedCount}
                        />
                        <DeliveryOperationalMetric
                            label="Napuštene"
                            value={health.runs.abandonedCount}
                        />
                    </div>
                </Stack>
            </Card>
            <Card className="p-4">
                <Stack spacing={3}>
                    <Typography component="h2" level="body1" semiBold>
                        Praćenje aktivnih ruta
                    </Typography>
                    <div className="grid grid-cols-2 gap-3">
                        <DeliveryOperationalMetric
                            label="Uživo"
                            value={health.tracking.liveCount}
                        />
                        <DeliveryOperationalMetric
                            label="Odgođeno"
                            value={health.tracking.delayedCount}
                        />
                        <DeliveryOperationalMetric
                            label="Nedostupno"
                            value={health.tracking.unavailableCount}
                        />
                        <DeliveryOperationalMetric
                            label="Nije zaprimljeno"
                            value={health.tracking.notReceivedCount}
                        />
                    </div>
                </Stack>
            </Card>
            <Card className="p-4">
                <Stack spacing={3}>
                    <Typography component="h2" level="body1" semiBold>
                        Planiranje rute
                    </Typography>
                    <div className="grid grid-cols-2 gap-3">
                        <DeliveryOperationalMetric
                            label="Lokalna procjena"
                            value={`${health.runs.localFallbackCount}/${health.runs.modernPlanCount}`}
                        />
                        <DeliveryOperationalMetric
                            label="Udio"
                            value={formatDeliveryOperationalPercentage(
                                health.runs.localFallbackRate,
                            )}
                        />
                        <DeliveryOperationalMetric
                            label="Čeka preusmjeravanje"
                            value={health.reroutes.pendingCount}
                        />
                        <DeliveryOperationalMetric
                            label="Zastarjelo"
                            value={health.reroutes.staleCount}
                        />
                    </div>
                </Stack>
            </Card>
            <Card className="p-4">
                <Stack spacing={3}>
                    <Typography component="h2" level="body1" semiBold>
                        Sinkronizirane akcije
                    </Typography>
                    <div className="grid grid-cols-2 gap-3">
                        <DeliveryOperationalMetric
                            label="Odgođene 5+ min"
                            value={health.actions.delayedReplayCount}
                        />
                        <DeliveryOperationalMetric
                            label="Najveće kašnjenje"
                            value={formatDeliveryOperationalDuration(
                                health.actions.maximumReplayDelayMs,
                            )}
                        />
                    </div>
                </Stack>
            </Card>
        </div>
    );
}
