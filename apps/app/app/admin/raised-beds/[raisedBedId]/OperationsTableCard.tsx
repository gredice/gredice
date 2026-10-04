import {
    RAISED_BED_ABANDONED_ACTIONS_DISABLED_MESSAGE,
    RAISED_BED_ABANDONED_DUE_TO_INACTIVITY_MESSAGE,
} from '@gredice/js/raisedBeds';
import { Alert } from '@gredice/ui/Alert';
import { Card, CardHeader, CardOverflow, CardTitle } from '@gredice/ui/Card';
import { Warning } from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import {
    scrollableTableCardClassName,
    scrollableTableCardOverflowClassName,
} from '../../../../components/admin/cards/tableCardLayout';
import { OperationsTable } from '../../../../components/operations/OperationsTable';
import { OperationCreateModal } from './OperationCreateModal';

export function OperationsTableCard({
    accountId,
    gardenId,
    isRaisedBedAbandoned,
    raisedBedId,
    raisedBedFieldId,
}: {
    accountId: string;
    gardenId?: number;
    isRaisedBedAbandoned?: boolean;
    raisedBedId?: number;
    raisedBedFieldId?: number;
}) {
    return (
        <Card className={scrollableTableCardClassName}>
            <CardHeader>
                <Row justifyContent="space-between">
                    <CardTitle>Radnje</CardTitle>
                    {!isRaisedBedAbandoned && (
                        <OperationCreateModal
                            accountId={accountId}
                            gardenId={gardenId}
                            raisedBedId={raisedBedId}
                            raisedBedFieldId={raisedBedFieldId}
                        />
                    )}
                </Row>
            </CardHeader>
            {isRaisedBedAbandoned && (
                <div className="px-4 pb-4">
                    <Alert
                        color="warning"
                        startDecorator={<Warning className="size-4 shrink-0" />}
                    >
                        <Stack spacing={1}>
                            <Typography level="body2" semiBold>
                                {RAISED_BED_ABANDONED_DUE_TO_INACTIVITY_MESSAGE}
                            </Typography>
                            <Typography level="body3">
                                {RAISED_BED_ABANDONED_ACTIONS_DISABLED_MESSAGE}
                            </Typography>
                        </Stack>
                    </Alert>
                </div>
            )}
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
