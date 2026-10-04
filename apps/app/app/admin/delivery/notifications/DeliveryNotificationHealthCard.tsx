import type { DeliveryLifecycleNotificationHealth } from '@gredice/storage';
import { Card } from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import {
    deliveryNotificationChannelLabel,
    deliveryNotificationSeverityLabel,
    deliveryNotificationSeverityTone,
    summarizeDeliveryNotificationHealth,
} from './deliveryNotificationPresentation';

function formatPercentage(value: number) {
    return new Intl.NumberFormat('hr-HR', {
        maximumFractionDigits: 1,
        style: 'percent',
    }).format(value);
}

export function DeliveryNotificationHealthCard({
    health,
    showOperationalAlerts = false,
    title,
}: {
    health: DeliveryLifecycleNotificationHealth;
    showOperationalAlerts?: boolean;
    title: string;
}) {
    const summary = summarizeDeliveryNotificationHealth(health);

    return (
        <Card className="p-4">
            <Stack spacing={3}>
                <Row
                    className="min-w-0 flex-wrap"
                    justifyContent="space-between"
                    spacing={2}
                >
                    <Typography component="h2" level="body1" semiBold>
                        {title}
                    </Typography>
                    <Chip
                        color={deliveryNotificationSeverityTone(
                            health.severity,
                        )}
                        size="sm"
                        variant="soft"
                    >
                        {deliveryNotificationSeverityLabel(health.severity)}
                    </Chip>
                </Row>

                <Typography level="body3" className="text-muted-foreground">
                    <LocalDateTime>{health.from}</LocalDateTime>
                    {' – '}
                    <LocalDateTime>{health.to}</LocalDateTime>
                </Typography>

                <div className="grid grid-cols-3 gap-3">
                    <Stack spacing={1}>
                        <Typography
                            level="body3"
                            className="text-muted-foreground"
                        >
                            Završeni pokušaji
                        </Typography>
                        <Typography level="h6" semiBold>
                            {summary.terminalCount}
                        </Typography>
                    </Stack>
                    <Stack spacing={1}>
                        <Typography
                            level="body3"
                            className="text-muted-foreground"
                        >
                            Neuspješni
                        </Typography>
                        <Typography level="h6" semiBold>
                            {summary.failureCount}
                        </Typography>
                    </Stack>
                    <Stack spacing={1}>
                        <Typography
                            level="body3"
                            className="text-muted-foreground"
                        >
                            Udio grešaka
                        </Typography>
                        <Typography level="h6" semiBold>
                            {formatPercentage(summary.failureRate)}
                        </Typography>
                    </Stack>
                </div>

                <div className="flex flex-wrap gap-2">
                    {health.channels.length === 0 ? (
                        <Typography
                            level="body3"
                            className="text-muted-foreground"
                        >
                            Nema završenih pokušaja u ovom razdoblju.
                        </Typography>
                    ) : (
                        health.channels.map((channel) => (
                            <Chip
                                color={deliveryNotificationSeverityTone(
                                    channel.severity,
                                )}
                                key={channel.channel}
                                size="sm"
                                variant="outlined"
                            >
                                {deliveryNotificationChannelLabel(
                                    channel.channel,
                                )}
                                {': '}
                                {channel.failureCount}/{channel.terminalCount}
                            </Chip>
                        ))
                    )}
                </div>

                {showOperationalAlerts && (
                    <div className="flex flex-wrap gap-2">
                        {health.alerts.retryExhausted && (
                            <Chip color="error" size="sm" variant="soft">
                                Iscrpljeni pokušaji:{' '}
                                {health.retryExhaustedCount}
                            </Chip>
                        )}
                        {health.alerts.staleEligibleQueue && (
                            <Chip color="warning" size="sm" variant="soft">
                                Zastarjeli red: {health.staleEligibleQueueCount}
                            </Chip>
                        )}
                        {health.alerts.ambiguousEmailSending && (
                            <Chip color="warning" size="sm" variant="soft">
                                Nejasno slanje e-maila:{' '}
                                {health.ambiguousEmailSendingCount}
                            </Chip>
                        )}
                        {!health.alerts.retryExhausted &&
                            !health.alerts.staleEligibleQueue &&
                            !health.alerts.ambiguousEmailSending &&
                            !health.alerts.systemicFailure && (
                                <Chip color="success" size="sm" variant="soft">
                                    Nema operativnih upozorenja
                                </Chip>
                            )}
                    </div>
                )}
            </Stack>
        </Card>
    );
}
