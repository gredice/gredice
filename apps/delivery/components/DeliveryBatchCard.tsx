'use client';

import { Button } from '@gredice/ui/Button';
import { Card, CardContent } from '@gredice/ui/Card';
import { Calendar, Play, Truck } from '@gredice/ui/icons';
import { Typography } from '@gredice/ui/Typography';
import type { DeliveryBatchSummary } from '../lib/deliveryDashboardTypes';
import { formatDeliveryDateTime } from '../lib/deliveryFormatting';

export function DeliveryBatchCard({
    batch,
    loading,
    disabled,
    onStart,
}: {
    batch: DeliveryBatchSummary;
    loading: boolean;
    disabled: boolean;
    onStart: () => void;
}) {
    return (
        <Card>
            <CardContent
                noHeader
                className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
                <div className="flex min-w-0 items-start gap-3">
                    <div className="rounded-lg bg-secondary p-2 text-secondary-foreground">
                        <Calendar className="size-5" />
                    </div>
                    <div className="min-w-0">
                        <Typography level="body1" semiBold>
                            {formatDeliveryDateTime(batch.startAt)}
                        </Typography>
                        <Typography
                            level="body3"
                            className="mt-1 flex items-center gap-1 text-muted-foreground"
                        >
                            <Truck className="size-4" />
                            {batch.deliveryCount}{' '}
                            {batch.deliveryCount === 1 ? 'dostava' : 'dostava'}
                        </Typography>
                    </div>
                </div>
                <Button
                    loading={loading}
                    disabled={disabled}
                    onClick={onStart}
                    startDecorator={<Play className="size-4" />}
                    className="sm:min-w-48"
                >
                    Preuzmi i pokreni rutu
                </Button>
            </CardContent>
        </Card>
    );
}
