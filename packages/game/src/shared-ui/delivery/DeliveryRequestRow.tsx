import { TimeRange } from '@gredice/ui/LocalDateTime';
import { OperationImage } from '@gredice/ui/OperationImage';
import { PlantOrSortImage } from '@gredice/ui/plants';
import { Close, MapPin, ShoppingCart, Timer, Truck } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import type { DeliveryRequestData } from '../../hooks/useDeliveryRequests';
import {
    CANCEL_REASON_OPTIONS,
    DeliveryCancelRequestModal,
} from './DeliveryCancelRequestModal';
import { DeliveryStatusChip } from './DeliveryStatusChip';

function canCancelRequest(request: DeliveryRequestData): boolean {
    if (request.state !== 'pending' && request.state !== 'confirmed') {
        return false;
    }

    return true;
}

function formatFieldPosition(positionIndex: number | null | undefined): string {
    if (positionIndex == null) return '';
    // Position index is 0-based, convert to human-readable (1-9)
    return `Polje ${positionIndex + 1}`;
}

export function DeliveryRequestRow({
    request,
    showSlot = true,
    showDestination = true,
}: {
    request: DeliveryRequestData;
    showSlot?: boolean;
    showDestination?: boolean;
}) {
    const canCancel = canCancelRequest(request);
    const operationData = request.operationData;
    const plantSort = request.plantSort;

    // Prefer plantSort info over operation entity info when there's a field position
    const hasPlantSort = Boolean(plantSort?.information?.name);
    const displayName = hasPlantSort
        ? plantSort?.information?.name
        : operationData?.information?.label || operationData?.information?.name;
    const displayImageUrl = hasPlantSort
        ? (plantSort?.image.cover?.url ??
          plantSort?.information?.plant?.image?.cover?.url)
        : operationData?.image?.cover?.url;
    const hasOperationDetails = displayName;

    return (
        <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-2 md:items-center md:justify-between">
            <Stack spacing={1}>
                {/* Operation/Plant details */}
                {hasOperationDetails && (
                    <Row spacing={1}>
                        <PlantOrSortImage
                            coverUrl={displayImageUrl}
                            alt={displayName || 'Biljka'}
                            width={48}
                            height={48}
                            className="rounded-md shrink-0"
                        />
                        <Stack className="w-full min-w-0">
                            <Typography level="body1" semiBold noWrap>
                                {displayName}
                            </Typography>
                            {hasPlantSort && (
                                <Row spacing={1}>
                                    <OperationImage
                                        size={32}
                                        operation={{
                                            image: operationData?.image,
                                            information:
                                                operationData?.information,
                                        }}
                                    />
                                    <Typography level="body1">
                                        {operationData?.information?.label ||
                                            operationData?.information?.name}
                                    </Typography>
                                </Row>
                            )}
                            {(request.raisedBed?.name ||
                                request.raisedBedField?.positionIndex !=
                                    null) && (
                                <Typography level="body3">
                                    {[
                                        request.raisedBed?.name,
                                        formatFieldPosition(
                                            request.raisedBedField
                                                ?.positionIndex,
                                        ),
                                    ]
                                        .filter(Boolean)
                                        .join(' • ')}
                                </Typography>
                            )}
                        </Stack>
                    </Row>
                )}

                {/* Delivery/Pickup mode indicator - only show if no operation details */}
                {!hasOperationDetails &&
                    (request.mode === 'delivery' ? (
                        <Row spacing={1}>
                            <Truck className="size-5 shrink-0" />
                            <Typography>Dostava</Typography>
                        </Row>
                    ) : (
                        <Row spacing={1}>
                            <ShoppingCart className="size-5 shrink-0" />
                            <Typography>Preuzimanje</Typography>
                        </Row>
                    ))}

                {showDestination && request.address && (
                    <Row spacing={1} alignItems="start">
                        <MapPin className="size-4 mt-0.5 text-muted-foreground" />
                        <Stack spacing={0.5}>
                            <Typography level="body2">
                                {request.address.label}
                            </Typography>
                            <Typography level="body3" secondary>
                                {request.address.street1}
                                {request.address.street2 &&
                                    `, ${request.address.street2}`}
                                <br />
                                {request.address.postalCode}{' '}
                                {request.address.city}
                            </Typography>
                        </Stack>
                    </Row>
                )}

                {showDestination && request.location && (
                    <Row spacing={1}>
                        <MapPin className="size-4 text-muted-foreground" />
                        <Typography level="body2">
                            {request.location.name}
                        </Typography>
                    </Row>
                )}

                {request.slot && showSlot && (
                    <Row spacing={1}>
                        <Timer className="size-4 text-muted-foreground" />
                        <Typography level="body2">
                            <TimeRange
                                startAt={request.slot.startAt}
                                endAt={request.slot.endAt}
                            />
                        </Typography>
                    </Row>
                )}

                {request.requestNotes && (
                    <Stack spacing={0.5}>
                        <Typography level="body3" secondary>
                            Napomene:
                        </Typography>
                        <Typography level="body2">
                            {request.requestNotes}
                        </Typography>
                    </Stack>
                )}
            </Stack>
            <Stack className="items-end">
                <Row spacing={1}>
                    <DeliveryStatusChip state={request.state} />
                    {canCancel && (
                        <DeliveryCancelRequestModal
                            request={request}
                            trigger={
                                <Button
                                    variant="outlined"
                                    color="danger"
                                    size="sm"
                                    startDecorator={
                                        <Close className="size-4" />
                                    }
                                >
                                    Otkaži
                                </Button>
                            }
                        />
                    )}
                </Row>
                {request.cancelReason && (
                    <Typography
                        level="body3"
                        className="text-balance text-right"
                    >
                        Razlog:{' '}
                        {CANCEL_REASON_OPTIONS.find(
                            (opt) => opt.value === request.cancelReason,
                        )?.label || request.cancelReason}
                    </Typography>
                )}
            </Stack>
        </div>
    );
}
