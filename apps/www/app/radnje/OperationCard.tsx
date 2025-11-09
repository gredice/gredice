import type { OperationData } from '@gredice/client';
import { OperationImage } from '@gredice/ui/OperationImage';
import { Card, CardContent } from '@signalco/ui-primitives/Card';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { KnownPages } from '../../src/KnownPages';

export function OperationCard({
    operation,
}: {
    operation: Omit<OperationData, 'entityType' | 'createdAt' | 'updatedAt'>;
}) {
    return (
        <Card
            href={KnownPages.Operation(operation.information.label)}
            className="border-tertiary border-b-4"
        >
            <CardContent noHeader>
                <Row justifyContent="space-between" spacing={1}>
                    <Row spacing={2}>
                        <OperationImage operation={operation} size={30} />
                        <Stack>
                            <Typography semiBold>
                                {operation.information.label}
                            </Typography>
                            <Typography level="body2" className="text-pretty">
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
