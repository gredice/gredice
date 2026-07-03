import type { OperationData } from '@gredice/client';
import { Card, CardContent } from '@gredice/ui/Card';
import { OperationImage } from '@gredice/ui/OperationImage';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import Link from 'next/link';
import { KnownPages } from '../../src/KnownPages';
import { getOperationImageViewTransitionName } from './operationViewTransition';

type OperationCardData = Pick<
    OperationData,
    'attributes' | 'id' | 'image' | 'information' | 'prices'
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
        <Link
            className="group block h-full rounded-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
            href={KnownPages.Operation(operation.information.label)}
        >
            <Card
                className={cx(
                    'h-full border-tertiary border-b-4 transition-colors group-hover:bg-accent group-hover:text-accent-foreground',
                    compact && 'p-1',
                )}
            >
                <CardContent noHeader className={cx(compact && 'px-2 py-1')}>
                    <Row justifyContent="space-between" spacing={2}>
                        <Row
                            spacing={compact ? 3 : 4}
                            className="min-w-0 flex-1"
                        >
                            <span
                                className="public-content-card-view-transition inline-flex shrink-0"
                                style={{
                                    viewTransitionName:
                                        getOperationImageViewTransitionName(
                                            operation.id,
                                        ),
                                }}
                            >
                                <OperationImage
                                    operation={operation}
                                    size={compact ? 48 : 72}
                                />
                            </span>
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
        </Link>
    );
}
