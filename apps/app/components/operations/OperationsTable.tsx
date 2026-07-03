import {
    getAccounts,
    getAllOperations,
    getAllRaisedBeds,
    getEntitiesFormatted,
    getFarms,
    getGardens,
} from '@gredice/storage';
import { Chip } from '@gredice/ui/Chip';
import { IconButton } from '@gredice/ui/IconButton';
import { Calendar, Check } from '@gredice/ui/icons';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Row } from '@gredice/ui/Row';
import { RaisedBedLabel } from '@gredice/ui/raisedBeds';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import Link from 'next/link';
import { VerifyOperationModal } from '../../app/admin/schedule/VerifyOperationModal';
import type { EntityStandardized } from '../../lib/@types/EntityStandardized';
import { KnownPages } from '../../src/KnownPages';
import { NoDataPlaceholder } from '../shared/placeholders/NoDataPlaceholder';
import { OperationCancelButton } from './OperationCancelButton';
import { OperationRescheduleButton } from './OperationRescheduleButton';

export async function OperationsTable({
    accountId,
    gardenId,
    raisedBedId,
    raisedBedFieldId,
    fromDate,
}: {
    accountId?: string;
    gardenId?: number;
    raisedBedId?: number;
    raisedBedFieldId?: number;
    fromDate?: Date;
} = {}) {
    const [operationsData, operations, accounts, farms, gardens, raisedBeds] =
        await Promise.all([
            getEntitiesFormatted<EntityStandardized>('operation'),
            getAllOperations(fromDate ? { from: fromDate } : undefined),
            getAccounts(),
            getFarms(),
            getGardens(),
            getAllRaisedBeds(),
        ]);
    const filteredOperations = operations.filter((op) => {
        if (accountId && op.accountId !== accountId) return false;
        if (gardenId && op.gardenId !== gardenId) return false;
        if (raisedBedId && op.raisedBedId !== raisedBedId) return false;
        if (raisedBedFieldId && op.raisedBedFieldId !== raisedBedFieldId)
            return false;
        return true;
    });
    const operationsWithDetails = filteredOperations.map((operation) => {
        const operationDetails = operationsData?.find(
            (op) => op.id === operation.entityId,
        );
        return {
            ...operation,
            details: {
                label: operationDetails?.information?.label || 'N/A',
            },
        };
    });

    if (!operationsWithDetails.length) {
        return (
            <div className="p-4">
                <NoDataPlaceholder />
            </div>
        );
    }

    return (
        <ul className="divide-y">
            {operationsWithDetails.map((operation) => {
                const operationRaisedBed = operation.raisedBedId
                    ? raisedBeds.find((rb) => rb.id === operation.raisedBedId)
                    : null;
                const operationRaisedBedField =
                    operationRaisedBed && operation.raisedBedFieldId
                        ? operationRaisedBed.fields.find(
                              (field) =>
                                  field.id === operation.raisedBedFieldId,
                          )
                        : null;
                const accountUserNames =
                    accounts
                        .find((account) => account.id === operation.accountId)
                        ?.accountUsers.map((user) => user.user.userName)
                        .join(', ') ?? null;
                const farmName = operation.farmId
                    ? (farms.find((farm) => farm.id === operation.farmId)
                          ?.name ?? 'N/A')
                    : null;
                const gardenName = operation.gardenId
                    ? (gardens.find(
                          (garden) => garden.id === operation.gardenId,
                      )?.name ?? 'N/A')
                    : null;
                const operationLabel =
                    operation.details.label || operation.entityId.toString();
                const statusColor =
                    operation.status === 'completed'
                        ? 'success'
                        : operation.status === 'planned'
                          ? 'info'
                          : operation.status === 'canceled'
                            ? 'neutral'
                            : 'warning';
                const statusLabel =
                    operation.status === 'pendingVerification'
                        ? 'Čeka verifikaciju'
                        : operation.status;
                const completedDate = operation.completedAt
                    ? new Date(operation.completedAt)
                    : null;

                return (
                    <li
                        key={operation.id}
                        className="px-3 py-3 transition-colors hover:bg-muted/40 sm:px-4"
                    >
                        <div className="flex min-w-0 flex-col gap-3">
                            <Stack spacing={1} className="min-w-0 flex-1">
                                <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                                    <Link
                                        href={KnownPages.Operation(
                                            operation.id,
                                        )}
                                        className="min-w-0 font-medium text-primary underline-offset-4 hover:underline"
                                    >
                                        ID {operation.id}
                                    </Link>
                                    <Typography
                                        level="body2"
                                        component="h3"
                                        semiBold
                                        className="min-w-0 break-words"
                                    >
                                        {operationLabel}
                                    </Typography>
                                </div>
                                <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                                    <Typography
                                        level="body3"
                                        component="span"
                                        className="sr-only"
                                    >
                                        Mjesto
                                    </Typography>
                                    {accountUserNames && (
                                        <span className="max-w-full break-words">
                                            {accountUserNames}
                                        </span>
                                    )}
                                    {farmName && (
                                        <span className="max-w-full break-words">
                                            {farmName}
                                        </span>
                                    )}
                                    {gardenName && (
                                        <span className="max-w-full break-words">
                                            {gardenName}
                                        </span>
                                    )}
                                    {operation.raisedBedId && (
                                        <RaisedBedLabel
                                            name={operationRaisedBed?.name}
                                            physicalId={
                                                operationRaisedBed?.physicalId ??
                                                null
                                            }
                                            size="compact"
                                        />
                                    )}
                                    {operationRaisedBedField && (
                                        <span className="shrink-0">
                                            {operationRaisedBedField.positionIndex +
                                                1}
                                        </span>
                                    )}
                                </div>
                            </Stack>
                            <div className="flex min-w-0 flex-wrap items-center justify-start gap-2">
                                <Chip
                                    className="w-fit"
                                    color={statusColor}
                                    size="sm"
                                >
                                    <span className="sr-only">Status: </span>
                                    {statusLabel}
                                </Chip>
                                {operation.status === 'planned' && (
                                    <Row
                                        spacing={2}
                                        className="whitespace-nowrap text-muted-foreground"
                                    >
                                        <Calendar className="size-4 shrink-0" />
                                        <Typography level="body3">
                                            <LocalDateTime time={false}>
                                                {operation.scheduledDate}
                                            </LocalDateTime>
                                        </Typography>
                                    </Row>
                                )}
                                {operation.status === 'pendingVerification' && (
                                    <Row
                                        spacing={2}
                                        className="whitespace-nowrap text-muted-foreground"
                                    >
                                        <Typography level="body3">
                                            <LocalDateTime time={false}>
                                                {completedDate}
                                            </LocalDateTime>
                                        </Typography>
                                    </Row>
                                )}
                                {operation.status === 'completed' && (
                                    <Row
                                        spacing={2}
                                        className="whitespace-nowrap text-muted-foreground"
                                    >
                                        <Typography level="body3">
                                            <LocalDateTime time={false}>
                                                {completedDate}
                                            </LocalDateTime>
                                        </Typography>
                                    </Row>
                                )}
                                <Chip
                                    color="neutral"
                                    size="sm"
                                    variant="outlined"
                                >
                                    Datum:{' '}
                                    <LocalDateTime time={false}>
                                        {operation.timestamp}
                                    </LocalDateTime>
                                </Chip>
                                <Typography
                                    level="body3"
                                    component="span"
                                    className="text-muted-foreground"
                                >
                                    Datum stvaranja:{' '}
                                    <LocalDateTime time={false}>
                                        {operation.createdAt
                                            ? new Date(operation.createdAt)
                                            : null}
                                    </LocalDateTime>
                                </Typography>
                                <fieldset className="m-0 flex shrink-0 flex-row items-center gap-2 border-0 p-0">
                                    <legend className="sr-only">Akcije</legend>
                                    {operation.status ===
                                        'pendingVerification' && (
                                        <VerifyOperationModal
                                            operationId={operation.id}
                                            label={operationLabel}
                                            trigger={
                                                <IconButton
                                                    variant="plain"
                                                    title="Verificiraj operaciju"
                                                >
                                                    <Check className="size-4 shrink-0" />
                                                </IconButton>
                                            }
                                        />
                                    )}
                                    <OperationRescheduleButton
                                        operation={{
                                            id: operation.id,
                                            entityId: operation.entityId,
                                            scheduledDate:
                                                operation.scheduledDate,
                                            status: operation.status,
                                        }}
                                        operationLabel={operationLabel}
                                    />
                                    <OperationCancelButton
                                        operation={{
                                            id: operation.id,
                                            entityId: operation.entityId,
                                            scheduledDate:
                                                operation.scheduledDate,
                                            status: operation.status,
                                        }}
                                        operationLabel={operationLabel}
                                    />
                                </fieldset>
                            </div>
                        </div>
                    </li>
                );
            })}
        </ul>
    );
}
