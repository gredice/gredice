import type { DeliveryOperationalHealth } from '@gredice/storage';
import { Card } from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import {
    deliveryOperationalSeverityLabel,
    deliveryOperationalSeverityTone,
} from './deliveryOperationalPresentation';

export function DeliveryOperationalHealthSummary({
    health,
}: {
    health: DeliveryOperationalHealth;
}) {
    return (
        <Card className="p-4">
            <Stack spacing={3}>
                <Row
                    className="min-w-0 flex-wrap"
                    justifyContent="space-between"
                    spacing={2}
                >
                    <Typography component="h2" level="body1" semiBold>
                        Operativno zdravlje dostave
                    </Typography>
                    <Chip
                        color={deliveryOperationalSeverityTone(health.severity)}
                        size="sm"
                        variant="soft"
                    >
                        {deliveryOperationalSeverityLabel(health.severity)}
                    </Chip>
                </Row>
                <Typography level="body3" className="text-muted-foreground">
                    <LocalDateTime>{health.from}</LocalDateTime>
                    {' – '}
                    <LocalDateTime>{health.to}</LocalDateTime>
                </Typography>
                <div className="flex flex-wrap gap-2">
                    {health.alerts.staleReroute && (
                        <Chip color="error" size="sm" variant="soft">
                            Zastarjela preusmjeravanja:{' '}
                            {health.reroutes.staleCount}
                        </Chip>
                    )}
                    {health.alerts.stalledRun && (
                        <Chip color="error" size="sm" variant="soft">
                            Rute bez aktivnosti: {health.runs.stalledCount}
                        </Chip>
                    )}
                    {health.alerts.trackingUnavailable && (
                        <Chip color="error" size="sm" variant="soft">
                            Nedostupno praćenje
                        </Chip>
                    )}
                    {health.alerts.elevatedLocalFallback && (
                        <Chip color="warning" size="sm" variant="soft">
                            Povišen udio lokalnih procjena
                        </Chip>
                    )}
                    {health.alerts.delayedOfflineReplay && (
                        <Chip color="warning" size="sm" variant="soft">
                            Odgođene sinkronizacije
                        </Chip>
                    )}
                    {health.severity === 'healthy' && (
                        <Chip color="success" size="sm" variant="soft">
                            Nema operativnih upozorenja
                        </Chip>
                    )}
                </div>
            </Stack>
        </Card>
    );
}
