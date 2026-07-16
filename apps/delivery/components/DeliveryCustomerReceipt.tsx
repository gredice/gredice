import { Button } from '@gredice/ui/Button';
import { Approved, ExternalLink, Info, Mail } from '@gredice/ui/icons';
import { Typography } from '@gredice/ui/Typography';
import { useId } from 'react';
import {
    customerDeliverySupportHref,
    customerHandoffAdvisory,
    customerHandoffVerificationLabel,
} from '../lib/deliveryCustomerReceipt';
import type { CustomerDeliveryReceiptSummary } from '../lib/deliveryDashboardTypes';
import { formatDeliveryDateTime } from '../lib/deliveryFormatting';

export function DeliveryCustomerReceipt({
    receipt,
}: {
    receipt: CustomerDeliveryReceiptSummary;
}) {
    const headingId = useId();
    const harvestDescription = [
        receipt.harvest.plantName,
        receipt.harvest.raisedBedName,
        receipt.harvest.fieldName,
    ]
        .filter(Boolean)
        .join(' · ');

    return (
        <section
            aria-labelledby={headingId}
            data-testid="customer-delivery-receipt"
            className="min-w-0 space-y-4 rounded-lg border border-emerald-200 bg-emerald-50/70 p-4 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50"
        >
            <div className="flex items-start gap-3">
                <Approved className="mt-0.5 size-5 shrink-0" />
                <div className="min-w-0">
                    <Typography
                        id={headingId}
                        component="h3"
                        level="body2"
                        semiBold
                    >
                        Potvrda o dostavi · {receipt.harvest.plantName}
                    </Typography>
                    <Typography level="body3" className="mt-1 text-current/80">
                        Dostava je evidentirana kao dovršena.
                    </Typography>
                </div>
            </div>

            <dl className="grid min-w-0 gap-3 sm:grid-cols-2">
                <div className="min-w-0">
                    <dt className="text-xs text-current/70">Dostavljeno</dt>
                    <dd className="break-words text-sm font-medium">
                        <time dateTime={receipt.deliveredAt}>
                            {formatDeliveryDateTime(receipt.deliveredAt)}
                        </time>
                    </dd>
                </div>
                <div className="min-w-0">
                    <dt className="text-xs text-current/70">Sadržaj predaje</dt>
                    <dd className="break-words text-sm font-medium">
                        {harvestDescription}
                    </dd>
                </div>
            </dl>

            <div className="flex items-start gap-2 rounded-md bg-background/70 p-3 text-foreground">
                <Info className="mt-0.5 size-4 shrink-0" />
                <div className="min-w-0 space-y-1">
                    <Typography level="body3" semiBold>
                        {customerHandoffVerificationLabel(receipt.verification)}
                    </Typography>
                    <Typography level="body3" className="text-muted-foreground">
                        {customerHandoffAdvisory}
                    </Typography>
                </div>
            </div>

            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
                {receipt.harvest.tracePath ? (
                    <Button
                        aria-label={`Otvori trag uroda: ${receipt.harvest.plantName}`}
                        href={`https://www.gredice.com${receipt.harvest.tracePath}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        size="sm"
                        variant="outlined"
                        className="min-h-11 min-w-0 justify-start whitespace-normal"
                        startDecorator={<ExternalLink className="size-4" />}
                    >
                        Trag uroda
                    </Button>
                ) : null}
                <Button
                    aria-label={`Prijavi da urod nedostaje: ${receipt.harvest.plantName}`}
                    href={customerDeliverySupportHref({
                        kind: 'missing',
                        receipt,
                    })}
                    size="sm"
                    variant="outlined"
                    className="min-h-11 min-w-0 justify-start whitespace-normal"
                    startDecorator={<Mail className="size-4" />}
                >
                    Prijavi da urod nedostaje
                </Button>
                <Button
                    aria-label={`Prijavi oštećenje: ${receipt.harvest.plantName}`}
                    href={customerDeliverySupportHref({
                        kind: 'damaged',
                        receipt,
                    })}
                    size="sm"
                    variant="outlined"
                    className="min-h-11 min-w-0 justify-start whitespace-normal"
                    startDecorator={<Mail className="size-4" />}
                >
                    Prijavi oštećenje
                </Button>
                <Button
                    aria-label={`Kontaktiraj podršku za dostavu: ${receipt.harvest.plantName}`}
                    href={customerDeliverySupportHref({
                        kind: 'support',
                        receipt,
                    })}
                    size="sm"
                    variant="outlined"
                    className="min-h-11 min-w-0 justify-start whitespace-normal"
                    startDecorator={<Mail className="size-4" />}
                >
                    Kontaktiraj podršku
                </Button>
            </div>
        </section>
    );
}
