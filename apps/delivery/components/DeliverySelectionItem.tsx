'use client';

import { Checkbox } from '@gredice/ui/Checkbox';
import { Chip } from '@gredice/ui/Chip';
import { Leaf, MapPin } from '@gredice/ui/icons';
import { Typography } from '@gredice/ui/Typography';
import type { DeliveryRouteOrderSummary } from '../lib/deliveryDashboardTypes';

export function DeliverySelectionItem({
    orders,
    checked,
    disabled,
    onCheckedChange,
}: {
    orders: DeliveryRouteOrderSummary[];
    checked: boolean;
    disabled: boolean;
    onCheckedChange: (checked: boolean) => void;
}) {
    const firstOrder = orders[0];
    if (!firstOrder) return null;
    const readyOrders = orders.filter((order) => order.readyForPickup);
    const hasReadyOrders = readyOrders.length > 0;

    return (
        <div
            className={
                checked
                    ? 'bg-primary/5 px-4 py-3'
                    : hasReadyOrders
                      ? 'px-4 py-3 transition-colors hover:bg-muted/50'
                      : 'bg-muted/30 px-4 py-3'
            }
        >
            <Checkbox
                id={`delivery-stop-${firstOrder.requestId}`}
                checked={checked}
                disabled={disabled || !hasReadyOrders}
                onCheckedChange={(value) => onCheckedChange(value === true)}
                className="mt-1 size-5"
                label={
                    <span className="block min-w-0 space-y-1 pl-1">
                        <span className="flex items-start gap-2 text-sm font-normal text-muted-foreground">
                            <MapPin className="mt-0.5 size-4 shrink-0" />
                            <span>{firstOrder.address}</span>
                        </span>
                        <Typography
                            component="span"
                            level="body3"
                            className="block text-muted-foreground"
                        >
                            {readyOrders.length} / {orders.length} spremno za
                            preuzimanje na ovoj stanici
                        </Typography>
                        <span className="block space-y-2 pt-1">
                            {orders.map((order) => (
                                <span
                                    key={order.requestId}
                                    className={
                                        order.readyForPickup
                                            ? 'block rounded-md border bg-background/70 p-2'
                                            : 'block rounded-md border border-dashed bg-muted/30 p-2'
                                    }
                                >
                                    <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                                        <Typography
                                            component="span"
                                            level="body2"
                                            semiBold
                                        >
                                            {order.contactName}
                                        </Typography>
                                        <Typography
                                            component="span"
                                            level="body3"
                                            className="text-muted-foreground"
                                        >
                                            {order.harvest.plantName}
                                        </Typography>
                                    </span>
                                    <Chip
                                        color={
                                            order.readyForPickup
                                                ? 'success'
                                                : 'warning'
                                        }
                                        size="sm"
                                        className="mt-2"
                                    >
                                        {order.pickupStatusLabel}
                                    </Chip>
                                    {order.requestNotes ? (
                                        <span className="mt-1 flex items-start gap-2 text-sm font-normal text-amber-800 dark:text-amber-200">
                                            <Leaf className="mt-0.5 size-4 shrink-0" />
                                            <span>{order.requestNotes}</span>
                                        </span>
                                    ) : null}
                                </span>
                            ))}
                        </span>
                    </span>
                }
            />
        </div>
    );
}
