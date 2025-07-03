import { getOperations } from "@gredice/storage";
import { Card, CardHeader, CardTitle, CardContent } from "@signalco/ui-primitives/Card";
import { Table } from "@signalco/ui-primitives/Table";
import { LocaleDateTime } from "../../../../components/shared/LocaleDateTime";
import { Row } from "@signalco/ui-primitives/Row";
import { OperationCreateModal } from "./OperationCreateModal";

async function OperationsTable({ accountId, gardenId, raisedBedId, raisedBedFieldId }: {
    accountId: string;
    gardenId?: number;
    raisedBedId?: number;
    raisedBedFieldId?: number;
}) {
    const operations = await getOperations(accountId, gardenId, raisedBedId, raisedBedFieldId);

    return (
        <Table>
            <Table.Header>
                <Table.Row>
                    <Table.Head>ID</Table.Head>
                    <Table.Head>Entity ID</Table.Head>
                    <Table.Head>Entity Type</Table.Head>
                    <Table.Head>Account ID</Table.Head>
                    <Table.Head>Garden ID</Table.Head>
                    <Table.Head>Raised Bed ID</Table.Head>
                    <Table.Head>Raised Bed Field ID</Table.Head>
                    <Table.Head>Created At</Table.Head>
                    <Table.Head>Status</Table.Head>
                    <Table.Head>Completed By</Table.Head>
                    <Table.Head>Error</Table.Head>
                    <Table.Head>Error Code</Table.Head>
                    <Table.Head>Scheduled Date</Table.Head>
                </Table.Row>
            </Table.Header>
            <Table.Body>
                {operations.map((operation) => (
                    <Table.Row key={operation.id}>
                        <Table.Cell>{operation.id}</Table.Cell>
                        <Table.Cell>{operation.entityId}</Table.Cell>
                        <Table.Cell>{operation.entityTypeName}</Table.Cell>
                        <Table.Cell>{operation.accountId}</Table.Cell>
                        <Table.Cell>{operation.gardenId}</Table.Cell>
                        <Table.Cell>{operation.raisedBedId}</Table.Cell>
                        <Table.Cell>{operation.raisedBedFieldId}</Table.Cell>
                        <Table.Cell>
                            <LocaleDateTime>
                                {operation.createdAt}
                            </LocaleDateTime>
                        </Table.Cell>
                        <Table.Cell>{operation.status}</Table.Cell>
                        <Table.Cell>{operation.completedBy}</Table.Cell>
                        <Table.Cell>{operation.error}</Table.Cell>
                        <Table.Cell>{operation.errorCode}</Table.Cell>
                        <Table.Cell>{operation.scheduledDate}</Table.Cell>
                    </Table.Row>
                ))}
            </Table.Body>
        </Table>
    );
}

export function OperationsTableCard({ accountId, gardenId, raisedBedId, raisedBedFieldId }: {
    accountId: string;
    gardenId?: number;
    raisedBedId?: number;
    raisedBedFieldId?: number;
}) {
    return (
        <Card>
            <CardHeader>
                <Row justifyContent="space-between">
                    <CardTitle>Operacije</CardTitle>
                    <OperationCreateModal accountId={accountId} gardenId={gardenId} raisedBedId={raisedBedId} raisedBedFieldId={raisedBedFieldId} />
                </Row>
            </CardHeader>
            <CardContent>
                <OperationsTable accountId={accountId} gardenId={gardenId} raisedBedId={raisedBedId} raisedBedFieldId={raisedBedFieldId} />
            </CardContent>
        </Card>
    );
}