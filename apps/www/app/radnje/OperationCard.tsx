import type { OperationData } from '@gredice/client';
import { Card, CardContent } from '@gredice/ui/Card';
import { OperationImage } from '@gredice/ui/OperationImage';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { KnownPages } from '../../src/KnownPages';

type OperationCardData = Pick<
    OperationData,
    'attributes' | 'image' | 'information' | 'prices'
>;

export function OperationCard({ operation }: { operation: OperationCardData }) {
    return (
        <Card
            href={KnownPages.Operation(operation.information.label)}
            className="border-tertiary border-b-4"
        >
            <CardContent noHeader>
                <Row justifyContent="space-between" spacing={2}>
                    <Row spacing={4}>
                        <OperationImage operation={operation} size={72} />
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
