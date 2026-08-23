'use client';

import { Card, CardContent } from '@gredice/ui/Card';
import { Checkbox } from '@gredice/ui/Checkbox';
import { Calendar, MapPin, Truck } from '@gredice/ui/icons';
import { Typography } from '@gredice/ui/Typography';
import type { DeliveryBatchSummary } from '../lib/deliveryDashboardTypes';
import {
    formatDeliveryDateTime,
    formatDeliveryTime,
} from '../lib/deliveryFormatting';
import { groupByDeliveryStop } from '../lib/deliveryStopGrouping';
import { DeliverySelectionItem } from './DeliverySelectionItem';

export function DeliveryBatchCard({
    batch,
    disabled,
    selectionLimitReached,
    selectedRequestIds,
    selectedStopKeys,
    onToggleBatch,
    onToggleOrder,
}: {
    batch: DeliveryBatchSummary;
    disabled: boolean;
    selectionLimitReached: boolean;
    selectedRequestIds: ReadonlySet<string>;
    selectedStopKeys: ReadonlySet<string>;
    onToggleBatch: (checked: boolean) => void;
    onToggleOrder: (requestId: string, checked: boolean) => void;
}) {
    const stopGroups = groupByDeliveryStop(batch.orders);
    const readyOrders = batch.orders.filter((order) => order.readyForPickup);
    const selectedCount = readyOrders.filter((order) =>
        selectedRequestIds.has(order.requestId),
    ).length;
    const allSelected =
        readyOrders.length > 0 && selectedCount === readyOrders.length;
    const batchSelectionState = allSelected
        ? true
        : selectedCount > 0
          ? 'indeterminate'
          : false;

    return (
        <Card>
            <CardContent noHeader className="p-0">
                <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                        <div className="rounded-lg bg-secondary p-2 text-secondary-foreground">
                            <Calendar className="size-5" />
                        </div>
                        <div className="min-w-0">
                            <Typography level="body1" semiBold>
                                {formatDeliveryDateTime(batch.startAt)} –{' '}
                                {formatDeliveryTime(batch.endAt)}
                            </Typography>
                            <Typography
                                level="body3"
                                className="mt-1 flex items-center gap-1 text-muted-foreground"
                            >
                                <Truck className="size-4" />
                                {batch.deliveryCount}{' '}
                                {batch.deliveryCount === 1 ? 'urod' : 'uroda'} ·{' '}
                                {readyOrders.length}/{batch.deliveryCount}{' '}
                                spremno · {batch.stopCount}{' '}
                                {batch.stopCount === 1
                                    ? 'stanica'
                                    : batch.stopCount < 5
                                      ? 'stanice'
                                      : 'stanica'}
                            </Typography>
                            {batch.pickupLocationName ? (
                                <Typography
                                    level="body3"
                                    className="mt-1 flex items-start gap-1 text-muted-foreground"
                                >
                                    <MapPin className="mt-0.5 size-4 shrink-0" />
                                    <span>
                                        {batch.pickupLocationName}
                                        {batch.pickupAddress
                                            ? ` · ${batch.pickupAddress}`
                                            : ''}
                                    </span>
                                </Typography>
                            ) : null}
                        </div>
                    </div>
                    <Checkbox
                        checked={batchSelectionState}
                        disabled={
                            disabled ||
                            readyOrders.length === 0 ||
                            (selectionLimitReached && !allSelected)
                        }
                        onCheckedChange={(value) =>
                            onToggleBatch(value === true)
                        }
                        label={
                            allSelected
                                ? 'Poništi spremne'
                                : readyOrders.length === 0
                                  ? 'Nema spremnih uroda'
                                  : 'Odaberi sve spremne'
                        }
                    />
                </div>
                <div className="divide-y border-t">
                    {stopGroups.flatMap((group) => {
                        const firstOrder = group.items[0];
                        if (!firstOrder) return [];
                        const readyGroupOrders = group.items.filter(
                            (order) => order.readyForPickup,
                        );
                        const firstReadyOrder = readyGroupOrders[0];
                        const checked =
                            readyGroupOrders.length > 0 &&
                            readyGroupOrders.every((order) =>
                                selectedRequestIds.has(order.requestId),
                            );
                        return [
                            <DeliverySelectionItem
                                key={group.stopKey}
                                orders={group.items}
                                checked={checked}
                                disabled={
                                    disabled ||
                                    readyGroupOrders.length === 0 ||
                                    (selectionLimitReached &&
                                        !selectedStopKeys.has(group.stopKey))
                                }
                                onCheckedChange={(value) => {
                                    if (firstReadyOrder) {
                                        onToggleOrder(
                                            firstReadyOrder.requestId,
                                            value,
                                        );
                                    }
                                }}
                            />,
                        ];
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
