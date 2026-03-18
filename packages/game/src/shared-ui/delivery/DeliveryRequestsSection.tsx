import { Navigate, Truck } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { Card, CardContent } from '@signalco/ui-primitives/Card';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useMemo } from 'react';
import {
    type DeliveryRequestData,
    useDeliveryRequests,
} from '../../hooks/useDeliveryRequests';
import { KnownPages } from '../../knownPages';
import { DeliveryRequestCard } from './DeliveryRequestCard';
import { DeliveryRequestGroupCard } from './DeliveryRequestGroupCard';

type DeliveryRequestGroup = {
    key: string;
    requests: DeliveryRequestData[];
    slotStart?: string | null;
    newestRequestCreatedAt?: string | Date | null;
};

function getGroupKey(request: DeliveryRequestData): string {
    const slotPart = request.slot?.id ?? request.slot?.startAt ?? 'no-slot';

    // For delivery mode, group by address
    if (request.mode === 'delivery' && request.address?.id) {
        return `${slotPart}-addr-${request.address.id}`;
    }

    // For pickup mode, group by location
    if (request.mode === 'pickup' && request.location?.id) {
        return `${slotPart}-loc-${request.location.id}`;
    }

    // Fallback: no grouping (individual request)
    return `${slotPart}-${request.id}`;
}

function getTimestamp(value?: string | Date | null): number {
    if (!value) {
        return Number.NEGATIVE_INFINITY;
    }

    return new Date(value).getTime();
}

function groupRequestsBySlotAndDestination(
    requests: DeliveryRequestData[],
): DeliveryRequestGroup[] {
    const map = new Map<string, DeliveryRequestGroup>();

    for (const request of requests) {
        const key = getGroupKey(request);
        const existing = map.get(key);

        if (existing) {
            existing.requests.push(request);
            if (
                getTimestamp(request.createdAt) >
                getTimestamp(existing.newestRequestCreatedAt)
            ) {
                existing.newestRequestCreatedAt = request.createdAt;
            }
        } else {
            map.set(key, {
                key,
                requests: [request],
                slotStart: request.slot?.startAt ?? null,
                newestRequestCreatedAt: request.createdAt,
            });
        }
    }

    return Array.from(map.values()).sort((a, b) => {
        const slotDifference =
            getTimestamp(b.slotStart) - getTimestamp(a.slotStart);
        if (slotDifference !== 0) {
            return slotDifference;
        }

        return (
            getTimestamp(b.newestRequestCreatedAt) -
            getTimestamp(a.newestRequestCreatedAt)
        );
    });
}

export function DeliveryRequestsSection() {
    const { data: requests, isLoading } = useDeliveryRequests();
    const groupedRequests = useMemo(
        () => (requests ? groupRequestsBySlotAndDestination(requests) : []),
        [requests],
    );

    return (
        <Stack spacing={2}>
            <Row spacing={1} justifyContent="space-between">
                <Typography level="h5">Moje dostave</Typography>
                <Button
                    variant="link"
                    href={KnownPages.GrediceDeliverySlots}
                    endDecorator={<Navigate className="size-5 shrink-0" />}
                >
                    📅 Termini dostave
                </Button>
            </Row>
            {isLoading ? (
                <Typography>Učitavanje dostava...</Typography>
            ) : groupedRequests.length > 0 ? (
                <Stack spacing={1}>
                    {groupedRequests.map((group) =>
                        group.requests.length === 1 ? (
                            <DeliveryRequestCard
                                key={group.requests[0].id}
                                request={group.requests[0]}
                            />
                        ) : (
                            <DeliveryRequestGroupCard
                                key={group.key}
                                requests={group.requests}
                            />
                        ),
                    )}
                </Stack>
            ) : (
                <Card>
                    <CardContent>
                        <Stack spacing={2} alignItems="center" className="py-8">
                            <Truck className="size-12 text-muted-foreground" />
                            <Typography level="h6">Nema dostava</Typography>
                            <Typography level="body3" secondary>
                                Trenutno nema zakazanih dostava
                            </Typography>
                        </Stack>
                    </CardContent>
                </Card>
            )}
        </Stack>
    );
}
