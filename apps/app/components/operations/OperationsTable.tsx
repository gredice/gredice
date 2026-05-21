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
import { Table } from '@gredice/ui/Table';
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

    return (
        <Table>
            <Table.Header>
                <Table.Row>
                    <Table.Head>ID</Table.Head>
                    <Table.Head>Naziv</Table.Head>
                    <Table.Head>Status</Table.Head>
                    <Table.Head>Mjesto</Table.Head>
                    <Table.Head>Datum</Table.Head>
                    <Table.Head>Datum stvaranja</Table.Head>
                    <Table.Head>Akcije</Table.Head>
                </Table.Row>
            </Table.Header>
            <Table.Body>
                {!operationsWithDetails.length && (
                    <Table.Row>
                        <Table.Cell colSpan={7}>
                            <NoDataPlaceholder />
                        </Table.Cell>
                    </Table.Row>
                )}
                {operationsWithDetails.map((operation) => {
                    const operationRaisedBed = operation.raisedBedId
                        ? raisedBeds.find(
                              (rb) => rb.id === operation.raisedBedId,
                          )
                        : null;
                    const operationRaisedBedField =
                        operationRaisedBed && operation.raisedBedFieldId
                            ? operationRaisedBed.fields.find(
                                  (field) =>
                                      field.id === operation.raisedBedFieldId,
                              )
                            : null;

                    return (
                        <Table.Row key={operation.id}>
                            <Table.Cell>
                                <Link href={KnownPages.Operation(operation.id)}>
                                    {operation.id}
                                </Link>
                            </Table.Cell>
                            <Table.Cell>
                                {operation.details.label || operation.entityId}
                            </Table.Cell>
                            <Table.Cell>
                                <Stack>
                                    <Chip
                                        className="w-fit"
                                        color={
                                            operation.status === 'completed'
                                                ? 'success'
                                                : operation.status ===
                                                    'pendingVerification'
                                                  ? 'warning'
                                                  : operation.status ===
                                                      'planned'
                                                    ? 'info'
                                                    : operation.status ===
                                                        'canceled'
                                                      ? 'neutral'
                                                      : 'warning'
                                        }
                                    >
                                        {operation.status ===
                                        'pendingVerification'
                                            ? 'Čeka verifikaciju'
                                            : operation.status}
                                    </Chip>
                                    {operation.status === 'planned' && (
                                        <Row spacing={2}>
                                            <Calendar className="size-4 shrink-0" />
                                            <LocalDateTime time={false}>
                                                {operation.scheduledDate}
                                            </LocalDateTime>
                                        </Row>
                                    )}
                                    {operation.status ===
                                        'pendingVerification' && (
                                        <Row spacing={2}>
                                            <LocalDateTime time={false}>
                                                {operation.completedAt
                                                    ? new Date(
                                                          operation.completedAt,
                                                      )
                                                    : null}
                                            </LocalDateTime>
                                        </Row>
                                    )}
                                    {operation.status === 'completed' && (
                                        <Row spacing={2}>
                                            {/* <span>{operation.completedBy}</span> */}
                                            <LocalDateTime time={false}>
                                                {operation.completedAt
                                                    ? new Date(
                                                          operation.completedAt,
                                                      )
                                                    : null}
                                            </LocalDateTime>
                                        </Row>
                                    )}
                                </Stack>
                            </Table.Cell>
                            <Table.Cell>
                                <Stack>
                                    <span>
                                        {accounts
                                            .find(
                                                (account) =>
                                                    account.id ===
                                                    operation.accountId,
                                            )
                                            ?.accountUsers.map(
                                                (user) => user.user.userName,
                                            )
                                            .join(', ')}
                                    </span>
                                    {operation.farmId && (
                                        <span>
                                            {farms.find(
                                                (farm) =>
                                                    farm.id ===
                                                    operation.farmId,
                                            )?.name ?? 'N/A'}
                                        </span>
                                    )}
                                    {operation.gardenId && (
                                        <span>
                                            {gardens.find(
                                                (garden) =>
                                                    garden.id ===
                                                    operation.gardenId,
                                            )?.name ?? 'N/A'}
                                        </span>
                                    )}
                                    {operation.raisedBedId && (
                                        <RaisedBedLabel
                                            physicalId={
                                                raisedBeds.find(
                                                    (rb) =>
                                                        rb.id ===
                                                        operation.raisedBedId,
                                                )?.physicalId ?? null
                                            }
                                        />
                                    )}
                                    {operationRaisedBedField && (
                                        <span>
                                            {operationRaisedBedField.positionIndex +
                                                1}
                                        </span>
                                    )}
                                </Stack>
                            </Table.Cell>
                            <Table.Cell>
                                <LocalDateTime time={false}>
                                    {operation.timestamp}
                                </LocalDateTime>
                            </Table.Cell>
                            <Table.Cell>
                                <LocalDateTime time={false}>
                                    {operation.createdAt
                                        ? new Date(operation.createdAt)
                                        : null}
                                </LocalDateTime>
                            </Table.Cell>
                            <Table.Cell>
                                <Row spacing={2}>
                                    {operation.status ===
                                        'pendingVerification' && (
                                        <VerifyOperationModal
                                            operationId={operation.id}
                                            label={
                                                operation.details.label ||
                                                operation.entityId.toString()
                                            }
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
                                        operationLabel={
                                            operation.details.label ||
                                            operation.entityId.toString()
                                        }
                                    />
                                    <OperationCancelButton
                                        operation={{
                                            id: operation.id,
                                            entityId: operation.entityId,
                                            scheduledDate:
                                                operation.scheduledDate,
                                            status: operation.status,
                                        }}
                                        operationLabel={
                                            operation.details.label ||
                                            operation.entityId.toString()
                                        }
                                    />
                                </Row>
                            </Table.Cell>
                        </Table.Row>
                    );
                })}
            </Table.Body>
        </Table>
    );
}
