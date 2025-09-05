import { OperationImage } from '@gredice/ui/OperationImage';
import { Card, CardContent } from '@signalco/ui-primitives/Card';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import type { OperationData } from '../../lib/plants/getOperationsData';
import { KnownPages } from '../../src/KnownPages';

export function OperationCard({ operation }: { operation: OperationData }) {
    return (
        <Card href={KnownPages.Operation(operation.information.label)}>
            <CardContent noHeader>
                <Row justifyContent="space-between">
                    <Row spacing={2}>
                        <OperationImage operation={operation} />
                        <Stack>
                            <Typography level="h6" component="h3">
                                {operation.information.label}
                            </Typography>
                            <Typography level="body2">
                                {operation.information.shortDescription}
                            </Typography>
                        </Stack>
                    </Row>
                    <Typography>
                        {operation.prices.perOperation.toFixed(2)}€
                    </Typography>
                </Row>
            </CardContent>
        </Card>
    );
}
