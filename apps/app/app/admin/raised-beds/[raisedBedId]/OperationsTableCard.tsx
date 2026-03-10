import {
    Card,
    CardHeader,
    CardOverflow,
    CardTitle,
} from '@signalco/ui-primitives/Card';
import { Row } from '@signalco/ui-primitives/Row';
import { OperationsTable } from '../../../../components/operations/OperationsTable';
import { OperationCreateModal } from './OperationCreateModal';

export function OperationsTableCard({
    accountId,
    gardenId,
    raisedBedId,
    raisedBedFieldId,
}: {
    accountId: string;
    gardenId?: number;
    raisedBedId?: number;
    raisedBedFieldId?: number;
}) {
    return (
        <Card>
            <CardHeader>
                <Row justifyContent="space-between">
                    <CardTitle>Radnje</CardTitle>
                    <OperationCreateModal
                        accountId={accountId}
                        gardenId={gardenId}
                        raisedBedId={raisedBedId}
                        raisedBedFieldId={raisedBedFieldId}
                    />
                </Row>
            </CardHeader>
            <CardOverflow className="max-h-96 overflow-auto">
                <OperationsTable
                    accountId={accountId}
                    gardenId={gardenId}
                    raisedBedId={raisedBedId}
                    raisedBedFieldId={raisedBedFieldId}
                />
            </CardOverflow>
        </Card>
    );
}
