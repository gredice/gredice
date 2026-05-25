import { Card, CardHeader, CardOverflow, CardTitle } from '@gredice/ui/Card';
import { Row } from '@gredice/ui/Row';
import {
    scrollableTableCardClassName,
    scrollableTableCardOverflowClassName,
} from '../../../../components/admin/cards/tableCardLayout';
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
        <Card className={scrollableTableCardClassName}>
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
            <CardOverflow className={scrollableTableCardOverflowClassName}>
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
