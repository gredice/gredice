import type { DeliveryOperationalHealth } from '@gredice/storage';
import { Card, CardHeader } from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { Typography } from '@gredice/ui/Typography';
import {
    deliveryOperationalExceptionOutcomeLabel,
    deliveryOperationalExceptionReasonLabel,
} from './deliveryOperationalPresentation';

export function DeliveryOperationalExceptions({
    health,
}: {
    health: DeliveryOperationalHealth;
}) {
    return (
        <Card>
            <CardHeader>
                <Typography component="h2" level="body1" semiBold>
                    Ishodi iznimki
                </Typography>
                <Typography level="body3" className="text-muted-foreground">
                    Agregirani ishodi i ograničeni razlozi u odabranom
                    razdoblju, bez bilješki i podataka o korisniku.
                </Typography>
            </CardHeader>
            <div className="flex flex-wrap gap-2 border-t p-4">
                {health.exceptions.length === 0 ? (
                    <Typography level="body3" className="text-muted-foreground">
                        Nema zabilježenih iznimki.
                    </Typography>
                ) : (
                    health.exceptions.map((exception) => (
                        <Chip
                            color="neutral"
                            key={`${exception.outcome}:${exception.reason}`}
                            size="sm"
                            variant="outlined"
                        >
                            {deliveryOperationalExceptionOutcomeLabel(
                                exception.outcome,
                            )}
                            {' · '}
                            {deliveryOperationalExceptionReasonLabel(
                                exception.reason,
                            )}
                            {': '}
                            {exception.count}
                        </Chip>
                    ))
                )}
            </div>
        </Card>
    );
}
