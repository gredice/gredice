import type { DeliveryLifecycleNotificationDiagnostics } from '@gredice/storage';
import { Card, CardHeader, CardOverflow } from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Typography } from '@gredice/ui/Typography';
import { NoDataPlaceholder } from '../../../../components/shared/placeholders/NoDataPlaceholder';
import {
    deliveryNotificationChannelLabel,
    deliveryNotificationMilestoneLabel,
    deliveryNotificationOutcomeLabel,
    deliveryNotificationOutcomeTone,
    deliveryNotificationProviderLabel,
    deliveryNotificationReasonLabel,
    groupDeliveryNotificationTimeline,
} from './deliveryNotificationPresentation';

export function DeliveryNotificationTimeline({
    diagnostics,
}: {
    diagnostics: DeliveryLifecycleNotificationDiagnostics;
}) {
    const groups = groupDeliveryNotificationTimeline(diagnostics.items);

    return (
        <Card>
            <CardHeader>
                <Typography component="h2" level="body1" semiBold>
                    Vremenska crta obavijesti
                </Typography>
                <Typography level="body3" className="text-muted-foreground">
                    Prikazani su samo operativni identifikatori, događaji i
                    ishodi kanala.
                </Typography>
            </CardHeader>
            <CardOverflow>
                {groups.length === 0 ? (
                    <div className="border-t p-4">
                        <NoDataPlaceholder>
                            Nema događaja za odabrane filtre u zadnja 24 sata.
                        </NoDataPlaceholder>
                    </div>
                ) : (
                    <div className="divide-y border-t">
                        {groups.map((request) => (
                            <section
                                className="space-y-3 px-3 py-4 sm:px-4"
                                key={request.requestId}
                            >
                                <div className="flex min-w-0 flex-wrap items-baseline gap-2">
                                    <Typography
                                        component="h3"
                                        level="body2"
                                        semiBold
                                    >
                                        Zahtjev
                                    </Typography>
                                    <Typography
                                        className="min-w-0 break-all text-muted-foreground"
                                        component="span"
                                        level="body3"
                                        mono
                                    >
                                        {request.requestId}
                                    </Typography>
                                </div>

                                {request.sources.map((source) => (
                                    <div
                                        className="space-y-3 border-l-2 border-border pl-3 sm:pl-4"
                                        key={
                                            source.sourceId === null
                                                ? 'source:null'
                                                : `source:value:${source.sourceId}`
                                        }
                                    >
                                        <div className="flex min-w-0 flex-wrap items-baseline gap-2">
                                            <Typography
                                                component="h4"
                                                level="body3"
                                                semiBold
                                                uppercase
                                            >
                                                Izvor
                                            </Typography>
                                            <Typography
                                                className="min-w-0 break-all text-muted-foreground"
                                                component="span"
                                                level="body3"
                                                mono={source.sourceId !== null}
                                            >
                                                {source.sourceId ??
                                                    'Nije zabilježen'}
                                            </Typography>
                                        </div>

                                        {source.channels.map((channel) => (
                                            <div
                                                className="space-y-2"
                                                key={
                                                    channel.channel ??
                                                    'pre-channel-decision'
                                                }
                                            >
                                                <Typography
                                                    component="h5"
                                                    level="body2"
                                                    semiBold
                                                >
                                                    {channel.channel === null
                                                        ? 'Prije odabira kanala'
                                                        : deliveryNotificationChannelLabel(
                                                              channel.channel,
                                                          )}
                                                </Typography>
                                                <ol className="divide-y rounded-md border">
                                                    {channel.items.map(
                                                        (item) => (
                                                            <li
                                                                className="space-y-2 px-3 py-3"
                                                                key={
                                                                    item.recordId
                                                                }
                                                            >
                                                                <div className="flex flex-wrap items-center gap-2">
                                                                    <Chip
                                                                        color="info"
                                                                        size="sm"
                                                                        variant="outlined"
                                                                    >
                                                                        {deliveryNotificationMilestoneLabel(
                                                                            item.milestone,
                                                                        )}
                                                                    </Chip>
                                                                    {item.kind ===
                                                                        'decision' && (
                                                                        <Chip
                                                                            color="neutral"
                                                                            size="sm"
                                                                            variant="outlined"
                                                                        >
                                                                            Odluka
                                                                            prije
                                                                            kanala
                                                                        </Chip>
                                                                    )}
                                                                    <Chip
                                                                        color={deliveryNotificationOutcomeTone(
                                                                            item.outcome,
                                                                        )}
                                                                        size="sm"
                                                                        variant="soft"
                                                                    >
                                                                        {deliveryNotificationOutcomeLabel(
                                                                            item.outcome,
                                                                        )}
                                                                    </Chip>
                                                                    <Typography
                                                                        className="ml-auto text-muted-foreground"
                                                                        component="span"
                                                                        level="body3"
                                                                    >
                                                                        <LocalDateTime>
                                                                            {
                                                                                item.occurredAt
                                                                            }
                                                                        </LocalDateTime>
                                                                    </Typography>
                                                                </div>
                                                                <Typography
                                                                    level="body3"
                                                                    className="text-muted-foreground"
                                                                >
                                                                    {item.kind ===
                                                                    'decision'
                                                                        ? 'Razlog odluke: '
                                                                        : `Kanal obrađuje: ${deliveryNotificationProviderLabel(
                                                                              item.provider,
                                                                          )} · `}
                                                                    {deliveryNotificationReasonLabel(
                                                                        item.reasonCode,
                                                                    )}
                                                                </Typography>
                                                            </li>
                                                        ),
                                                    )}
                                                </ol>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </section>
                        ))}
                    </div>
                )}
                {diagnostics.nextCursor && (
                    <Typography
                        center
                        className="border-t px-4 py-3 text-muted-foreground"
                        level="body3"
                    >
                        Prikazano je najnovijih 200 zapisa. Suzi filtre za
                        precizniju dijagnostiku.
                    </Typography>
                )}
            </CardOverflow>
        </Card>
    );
}
