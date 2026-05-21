import { Card, CardContent } from '@gredice/ui/Card';
import type { DeliveryRequestData } from '../../hooks/useDeliveryRequests';
import { DeliveryRequestRow } from './DeliveryRequestRow';

export function DeliveryRequestCard({
    request,
}: {
    request: DeliveryRequestData;
}) {
    return (
        <Card>
            <CardContent noHeader>
                <DeliveryRequestRow request={request} />
            </CardContent>
        </Card>
    );
}
