import type { OperationData } from '@gredice/client';
import { Card, CardContent } from '@gredice/ui/Card';
import { OperationImage } from '@gredice/ui/OperationImage';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import { KnownPages } from '../../src/KnownPages';

type OperationCardData = Pick<
    OperationData,
    'attributes' | 'image' | 'information' | 'prices'
>;

export function OperationCard({
    operation,
    variant = 'default',
}: {
    operation: OperationCardData;
    variant?: 'default' | 'compact';
}) {
    const compact = variant === 'compact';

    return (
        <Card
            href={KnownPages.Operation(operation.information.label)}
            className={cx('border-tertiary border-b-4', compact && 'p-1')}
        >
            <CardContent noHeader className={cx(compact && 'px-2 py-1')}>
                <Row justifyContent="space-between" spacing={2}>
                    <Row spacing={compact ? 3 : 4} className="min-w-0 flex-1">
                        <OperationImage
                            operation={operation}
                            size={compact ? 48 : 72}
                        />
                        <Stack className="min-w-0">
                            <Typography semiBold>
                                {operation.information.label}
                            </Typography>
                            <Typography
                                level="body2"
                                className={cx(
                                    'text-pretty',
                                    compact && 'leading-snug',
                                )}
                            >
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
