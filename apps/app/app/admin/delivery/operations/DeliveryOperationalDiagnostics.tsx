import type { DeliveryOperationalHealth } from '@gredice/storage';
import { Card, CardHeader, CardOverflow } from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Typography } from '@gredice/ui/Typography';
import {
    deliveryOperationalDiagnosticLabel,
    deliveryOperationalDiagnosticTone,
    formatDeliveryOperationalDuration,
} from './deliveryOperationalPresentation';

export function DeliveryOperationalDiagnostics({
    health,
}: {
    health: DeliveryOperationalHealth;
}) {
    return (
        <Card>
            <CardHeader>
                <Typography component="h2" level="body1" semiBold>
                    Operativna dijagnostika
                </Typography>
                <Typography level="body3" className="text-muted-foreground">
                    Prikazani su samo neprozirni ID rute, ograničeni kodovi i
                    agregirani brojevi. Nema adresa, koordinata ni podataka o
                    korisniku.
                </Typography>
            </CardHeader>
            <CardOverflow>
                {health.diagnostics.items.length === 0 ? (
                    <Typography
                        className="border-t p-4 text-muted-foreground"
                        level="body3"
                    >
                        Nema operativnih odstupanja u odabranom razdoblju.
                    </Typography>
                ) : (
                    <ol className="divide-y border-t">
                        {health.diagnostics.items.map((item) => (
                            <li
                                className="space-y-2 px-3 py-3 sm:px-4"
                                key={`${item.runId}:${item.kind}:${item.reasonCode}`}
                            >
                                <div className="flex min-w-0 flex-wrap items-center gap-2">
                                    <Chip
                                        color={deliveryOperationalDiagnosticTone(
                                            item.severity,
                                        )}
                                        size="sm"
                                        variant="soft"
                                    >
                                        {deliveryOperationalDiagnosticLabel(
                                            item.kind,
                                        )}
                                    </Chip>
                                    <Typography
                                        className="min-w-0 break-all text-muted-foreground"
                                        component="span"
                                        level="body3"
                                        mono
                                    >
                                        {item.runId}
                                    </Typography>
                                    <Typography
                                        className="ml-auto text-muted-foreground"
                                        component="span"
                                        level="body3"
                                    >
                                        <LocalDateTime>
                                            {item.occurredAt}
                                        </LocalDateTime>
                                    </Typography>
                                </div>
                                <Typography
                                    className="text-muted-foreground"
                                    level="body3"
                                >
                                    Kod: {item.reasonCode}
                                    {item.count > 1
                                        ? ` · Zapisa: ${item.count}`
                                        : ''}
                                    {item.ageMs !== undefined
                                        ? ` · Trajanje: ${formatDeliveryOperationalDuration(
                                              item.ageMs,
                                          )}`
                                        : ''}
                                </Typography>
                            </li>
                        ))}
                    </ol>
                )}
                {health.diagnostics.truncated && (
                    <Typography
                        center
                        className="border-t px-4 py-3 text-muted-foreground"
                        level="body3"
                    >
                        Prikazan je ograničen broj najnovijih zapisa.
                    </Typography>
                )}
            </CardOverflow>
        </Card>
    );
}
