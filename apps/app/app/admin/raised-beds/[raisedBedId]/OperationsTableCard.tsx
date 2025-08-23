import { getOperations } from "@gredice/storage";
import { Card, CardHeader, CardTitle, CardContent } from "@signalco/ui-primitives/Card";
import { Table } from "@signalco/ui-primitives/Table";
import { LocalDateTime } from "@gredice/ui/LocalDateTime";
import { Row } from "@signalco/ui-primitives/Row";
import { OperationCreateModal } from "./OperationCreateModal";
import { OperationsTable } from "../../../../components/operations/OperationsTable";

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
                <OperationsTable
                    accountId={accountId}
                    gardenId={gardenId}
                    raisedBedId={raisedBedId}
                    raisedBedFieldId={raisedBedFieldId} />
            </CardContent>
        </Card>
    );
}