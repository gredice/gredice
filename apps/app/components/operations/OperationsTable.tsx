import { getAccounts, getAllOperations, getAllRaisedBeds, getEntitiesFormatted, getGardens } from '@gredice/storage';
import { Table } from '@signalco/ui-primitives/Table';
import { EntityStandardized } from '../../lib/@types/EntityStandardized';
import { NoDataPlaceholder } from '../shared/placeholders/NoDataPlaceholder';
import { LocaleDateTime } from '../shared/LocaleDateTime';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Row } from '@signalco/ui-primitives/Row';
import { Chip } from '@signalco/ui-primitives/Chip';
import { Calendar, Tally3 } from '@signalco/ui-icons';

export async function OperationsTable() {
    const [operationsData, operations, accounts, gardens, raisedBeds] = await Promise.all([
        getEntitiesFormatted<EntityStandardized>('operation'),
        getAllOperations(),
        getAccounts(),
        getGardens(),
        getAllRaisedBeds()
    ]);
    const operationsWithDetails = operations.map(operation => {
        const operationDetails = operationsData?.find(op => op.id === operation.entityId);
        return {
            ...operation,
            details: {
                label: operationDetails?.information?.label || 'N/A'
            }
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
                </Table.Row>
            </Table.Header>
            <Table.Body>
                {!operationsWithDetails.length && (
                    <Table.Row>
                        <Table.Cell colSpan={4}>
                            <NoDataPlaceholder />
                        </Table.Cell>
                    </Table.Row>
                )}
                {operationsWithDetails.map(operation => {
                    return (
                        <Table.Row key={operation.id} className='group'>
                            <Table.Cell>
                                {operation.id}
                            </Table.Cell>
                            <Table.Cell>
                                {operation.details.label || operation.entityId}
                            </Table.Cell>
                            <Table.Cell>
                                <Stack>
                                    <Chip
                                        className='w-fit'
                                        color={operation.status === 'completed' ? 'success' : (operation.status === 'planned' ? 'info' : 'warning')}>
                                        {operation.status}
                                    </Chip>
                                    {operation.status === 'planned' && (
                                        <Row spacing={1}>
                                            <Calendar className="size-4 shrink-0" />
                                            <LocaleDateTime time={false}>
                                                {operation.scheduledDate}
                                            </LocaleDateTime>
                                        </Row>
                                    )}
                                    {operation.status === 'completed' && (
                                        <Row spacing={1}>
                                            {/* <span>{operation.completedBy}</span> */}
                                            <LocaleDateTime time={false}>
                                                {operation.completedAt ? new Date(operation.completedAt) : null}
                                            </LocaleDateTime>
                                        </Row>
                                    )}
                                </Stack>
                            </Table.Cell>
                            <Table.Cell>
                                <Stack>
                                    <span>{accounts.find(account => account.id === operation.accountId)?.accountUsers.map(user => user.user.userName).join(', ')}</span>
                                    {operation.gardenId && (
                                        <span>{gardens.find(garden => garden.id === operation.gardenId)?.name ?? 'N/A'}</span>
                                    )}
                                    {operation.raisedBedId && (
                                        <span><Tally3 className="size-4 shrink-0 rotate-90 mt-1 inline" /> Gr {raisedBeds.find(rb => rb.id === operation.raisedBedId)?.physicalId ?? 'N/A'}</span>
                                    )}
                                    {operation.raisedBedFieldId && (
                                        <span>{operation.raisedBedFieldId}</span>
                                    )}
                                </Stack>
                            </Table.Cell>
                            <Table.Cell>
                                <LocaleDateTime time={false}>
                                    {operation.timestamp}
                                </LocaleDateTime>
                            </Table.Cell>
                            <Table.Cell>
                                <LocaleDateTime time={false}>
                                    {operation.createdAt ? new Date(operation.createdAt) : null}
                                </LocaleDateTime>
                            </Table.Cell>
                        </Table.Row>
                    );
                })}
            </Table.Body>
        </Table>
    );
}