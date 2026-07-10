'use client';

import { Chip } from '@gredice/ui/Chip';
import { IconButton } from '@gredice/ui/IconButton';
import { Calendar, Check } from '@gredice/ui/icons';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { OperationImage } from '@gredice/ui/OperationImage';
import { Row } from '@gredice/ui/Row';
import { RaisedBedLabel } from '@gredice/ui/raisedBeds';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import Link from 'next/link';
import {
    operationListStatusColor,
    operationListStatusLabel,
} from '../../app/admin/operations/operationListLabels';
import type {
    OperationsListOperation,
    OperationsListOperationRow,
} from '../../app/admin/operations/operationsListTypes';
import { VerifyOperationModal } from '../../app/admin/schedule/VerifyOperationModal';
import { KnownPages } from '../../src/KnownPages';
import { OperationCancelButton } from './OperationCancelButton';
import { OperationRescheduleButton } from './OperationRescheduleButton';

function statusDate(operation: OperationsListOperation) {
    if (operation.status === 'planned') {
        return operation.scheduledDate;
    }

    if (
        operation.status === 'completed' ||
        operation.status === 'pendingVerification'
    ) {
        return operation.completedAt;
    }

    return null;
}

function dateForAction(value: string | null) {
    return value ? new Date(value) : undefined;
}

function operationActionPayload(operation: OperationsListOperationRow) {
    return {
        id: operation.id,
        entityId: operation.entityId,
        scheduledDate: dateForAction(operation.scheduledDate),
        status: operation.status,
    };
}

function sowingLocationLabel(operation: OperationsListOperation) {
    if (operation.kind !== 'sowing') {
        return null;
    }

    return operation.sowingLocation === 'greenhouse' ? 'Staklenik' : 'Direktno';
}

export function OperationListItem({
    operation,
}: {
    operation: OperationsListOperation;
}) {
    const actionPayload =
        operation.kind === 'operation'
            ? operationActionPayload(operation)
            : null;
    const currentStatusDate = statusDate(operation);
    const locationLabel = sowingLocationLabel(operation);
    const detailsHref =
        operation.kind === 'operation'
            ? KnownPages.Operation(operation.id)
            : KnownPages.SowingTask(
                  operation.raisedBedFieldId,
                  operation.plantCycleEventId,
              );

    return (
        <li className="group px-3 py-3 transition-colors hover:bg-muted/40 sm:px-4">
            <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                    <span
                        aria-hidden="true"
                        className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted text-muted-foreground"
                    >
                        <OperationImage
                            operation={operation.operationDefinition}
                            size={48}
                            className="size-12"
                        />
                    </span>
                    <Stack spacing={1} className="min-w-0 flex-1 pt-0.5">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <Link
                                href={detailsHref}
                                className="min-w-0 truncate font-medium text-primary underline-offset-4 hover:underline"
                            >
                                {operation.label}
                            </Link>
                            {operation.kind === 'sowing' && locationLabel ? (
                                <Chip
                                    color={
                                        operation.sowingLocation ===
                                        'greenhouse'
                                            ? 'success'
                                            : 'neutral'
                                    }
                                    size="sm"
                                    variant="outlined"
                                >
                                    {locationLabel}
                                </Chip>
                            ) : null}
                        </div>
                        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                            {operation.accountUserNames.length ? (
                                <span className="max-w-full truncate">
                                    {operation.accountUserNames.join(', ')}
                                </span>
                            ) : null}
                            {operation.farmName ? (
                                <span className="max-w-full truncate">
                                    {operation.farmName}
                                </span>
                            ) : null}
                            {operation.gardenName ? (
                                <span className="max-w-full truncate">
                                    {operation.gardenName}
                                </span>
                            ) : null}
                            {operation.raisedBedPhysicalId ||
                            operation.raisedBedName ? (
                                <RaisedBedLabel
                                    size="compact"
                                    physicalId={operation.raisedBedPhysicalId}
                                    name={operation.raisedBedName}
                                />
                            ) : null}
                            {operation.raisedBedFieldPosition ? (
                                <span>{operation.raisedBedFieldPosition}</span>
                            ) : null}
                            {operation.assignedUserNames.length ? (
                                <span className="max-w-full truncate">
                                    Dodijeljeno:{' '}
                                    {operation.assignedUserNames.join(', ')}
                                </span>
                            ) : null}
                        </div>
                    </Stack>
                </div>
                <div className="flex min-w-0 flex-wrap items-center justify-start gap-2 md:justify-end">
                    <Chip
                        className="w-fit"
                        color={operationListStatusColor(operation.status)}
                        size="sm"
                    >
                        {operationListStatusLabel(operation)}
                    </Chip>
                    {currentStatusDate ? (
                        <Row
                            spacing={2}
                            className="whitespace-nowrap text-muted-foreground"
                        >
                            {operation.status === 'planned' ? (
                                <Calendar className="size-4 shrink-0" />
                            ) : null}
                            <Typography level="body3">
                                <LocalDateTime time={false}>
                                    {currentStatusDate}
                                </LocalDateTime>
                            </Typography>
                        </Row>
                    ) : null}
                    <Chip color="neutral" size="sm" variant="outlined">
                        Datum:{' '}
                        <LocalDateTime time={false}>
                            {operation.timestamp}
                        </LocalDateTime>
                    </Chip>
                    <Typography
                        level="body3"
                        className="whitespace-nowrap text-muted-foreground"
                    >
                        Stvoreno:{' '}
                        <LocalDateTime time={false}>
                            {operation.createdAt}
                        </LocalDateTime>
                    </Typography>
                    {operation.kind === 'operation' && actionPayload ? (
                        <>
                            {operation.status === 'pendingVerification' ? (
                                <VerifyOperationModal
                                    operationId={operation.id}
                                    label={operation.label}
                                    trigger={
                                        <IconButton
                                            variant="plain"
                                            title="Verificiraj operaciju"
                                        >
                                            <Check className="size-4 shrink-0" />
                                        </IconButton>
                                    }
                                />
                            ) : null}
                            <OperationRescheduleButton
                                operation={actionPayload}
                                operationLabel={operation.label}
                            />
                            <OperationCancelButton
                                operation={actionPayload}
                                operationLabel={operation.label}
                            />
                        </>
                    ) : null}
                </div>
            </div>
        </li>
    );
}
