import { getAllRaisedBeds, getGardens } from '@gredice/storage';
import { Card, CardOverflow } from '@signalco/ui-primitives/Card';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { OperationsTable } from '../../../components/operations/OperationsTable';
import { auth } from '../../../lib/auth/auth';
import { BulkOperationCreateModal } from './BulkOperationCreateModal';

export const dynamic = 'force-dynamic';

export default async function OperationsPage() {
    await auth(['admin']);
    const [gardens, raisedBeds] = await Promise.all([
        getGardens(),
        getAllRaisedBeds(),
    ]);

    return (
        <Stack spacing={2}>
            <Row justify="space-between" align="center">
                <Typography level="h1" className="text-2xl" semiBold>
                    Radnje
                </Typography>
                <BulkOperationCreateModal
                    gardens={gardens}
                    raisedBeds={raisedBeds}
                />
            </Row>
            <Card>
                <CardOverflow>
                    <OperationsTable />
                </CardOverflow>
            </Card>
        </Stack>
    );
}
