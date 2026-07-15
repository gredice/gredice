import { Alert } from '@gredice/ui/Alert';
import { MyLocation, Timer, Warning } from '@gredice/ui/icons';
import type { CustomerDeliveryTrackingSummary } from '../lib/deliveryDashboardTypes';
import { formatDeliveryDateTime } from '../lib/deliveryFormatting';
import { deliveryTrackingMapVersion } from '../lib/deliveryTrackingPresentation';
import { DeliveryMap } from './DeliveryMap';

function trackingMessage(tracking: CustomerDeliveryTrackingSummary) {
    const lastUpdate = tracking.lastAcceptedAt
        ? formatDeliveryDateTime(tracking.lastAcceptedAt)
        : null;
    switch (tracking.status) {
        case 'live':
            return lastUpdate
                ? `Lokacija vozača je uživo. Zadnje ažuriranje: ${lastUpdate}.`
                : 'Lokacija vozača je uživo.';
        case 'delayed':
            return lastUpdate
                ? `Lokacija vozača kasni. Zadnje potvrđeno ažuriranje: ${lastUpdate}.`
                : 'Lokacija vozača kasni.';
        case 'offline':
            return lastUpdate
                ? `Praćenje je trenutačno izvan mreže. Zadnje potvrđeno ažuriranje: ${lastUpdate}.`
                : 'Praćenje je trenutačno izvan mreže.';
        case 'unavailable':
            return 'Lokacija vozača još nije dostupna. Status dostave i procjena dolaska i dalje će se ažurirati.';
    }
}

export function CustomerDeliveryTracking({
    runId,
    tracking,
}: {
    runId: string;
    tracking: CustomerDeliveryTrackingSummary;
}) {
    const showMap =
        tracking.mapAvailable &&
        (tracking.status === 'live' || tracking.status === 'delayed');
    const delayed = tracking.status === 'delayed';
    const offline = tracking.status === 'offline';

    return (
        <section className="space-y-3">
            <Alert
                role="status"
                aria-live="polite"
                color={delayed || offline ? 'warning' : 'info'}
                startDecorator={
                    offline ? (
                        <Warning className="size-5" />
                    ) : delayed ? (
                        <Timer className="size-5" />
                    ) : (
                        <MyLocation className="size-5" />
                    )
                }
            >
                {trackingMessage(tracking)}
            </Alert>
            {showMap ? (
                <DeliveryMap
                    mapUrl={`/api/map/${runId}`}
                    version={deliveryTrackingMapVersion(tracking)}
                    title={
                        tracking.status === 'live'
                            ? 'Trenutna lokacija vozača i moja dostava'
                            : 'Posljednja potvrđena lokacija vozača i moja dostava'
                    }
                />
            ) : null}
        </section>
    );
}
