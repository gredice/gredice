import { Chip } from '@gredice/ui/Chip';
import { RaisedBedLabel } from '@gredice/ui/raisedBeds';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { DeliveryRequestDetails } from './DeliveryRequestListTypes';

function getPlantSortName(request: DeliveryRequestDetails) {
    return (
        request.plantSort?.information?.name ??
        request.plantSort?.information?.plant?.information?.name ??
        'Nepoznata sorta'
    );
}

function getOperationLabel(request: DeliveryRequestDetails) {
    return request.operationData?.information?.label ?? null;
}

function getFieldLabel(request: DeliveryRequestDetails) {
    if (typeof request.raisedBedField?.positionIndex === 'number') {
        return `Polje ${request.raisedBedField.positionIndex + 1}`;
    }

    return request.raisedBed ? 'Cijela gredica' : null;
}

export function DeliveryRequestContents({
    request,
}: {
    request: DeliveryRequestDetails;
}) {
    const plantSortName = getPlantSortName(request);
    const operationLabel = getOperationLabel(request);
    const fieldLabel = getFieldLabel(request);

    return (
        <Stack spacing={0.75} className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <Typography level="body2" semiBold className="min-w-0 truncate">
                    {plantSortName}
                </Typography>
                {operationLabel ? (
                    <Typography
                        level="body3"
                        className="min-w-0 truncate text-muted-foreground"
                    >
                        {operationLabel}
                    </Typography>
                ) : null}
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
                {request.raisedBed ? (
                    <RaisedBedLabel
                        physicalId={request.raisedBed.physicalId}
                        name={request.raisedBed.name}
                        size="compact"
                        className="min-w-0"
                    />
                ) : (
                    <Typography level="body3" className="text-muted-foreground">
                        Nema podatka o gredici
                    </Typography>
                )}
                {fieldLabel ? (
                    <Chip color="neutral" size="sm" variant="outlined">
                        {fieldLabel}
                    </Chip>
                ) : null}
            </div>
        </Stack>
    );
}
