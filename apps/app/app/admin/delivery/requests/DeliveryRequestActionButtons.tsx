'use client';

import { Button } from '@gredice/ui/Button';
import { Navigate } from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { DeliveryRequestCancelButton } from './DeliveryRequestCancelButton';
import type { DeliveryRequestActionData } from './DeliveryRequestTypes';

export function DeliveryRequestActionButtons({
    label,
    request,
}: {
    label: string;
    request: DeliveryRequestActionData;
}) {
    return (
        <Row spacing={1} className="shrink-0">
            <DeliveryRequestCancelButton label={label} request={request} />
            <Button
                variant="plain"
                size="sm"
                href={`/admin/operations/${request.operationId}`}
                className="aspect-square px-0"
                aria-label="Otvori povezanu radnju"
                title="Otvori povezanu radnju"
            >
                <Navigate className="size-4 shrink-0" />
            </Button>
        </Row>
    );
}
