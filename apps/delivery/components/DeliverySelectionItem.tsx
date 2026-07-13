'use client';

import { Checkbox } from '@gredice/ui/Checkbox';
import { Leaf, MapPin } from '@gredice/ui/icons';
import { Typography } from '@gredice/ui/Typography';
import type { DeliveryRouteOrderSummary } from '../lib/deliveryDashboardTypes';

export function DeliverySelectionItem({
    order,
    checked,
    disabled,
    onCheckedChange,
}: {
    order: DeliveryRouteOrderSummary;
    checked: boolean;
    disabled: boolean;
    onCheckedChange: (checked: boolean) => void;
}) {
    return (
        <div
            className={
                checked
                    ? 'bg-primary/5 px-4 py-3'
                    : 'px-4 py-3 transition-colors hover:bg-muted/50'
            }
        >
            <Checkbox
                id={`delivery-order-${order.requestId}`}
                checked={checked}
                disabled={disabled}
                onCheckedChange={(value) => onCheckedChange(value === true)}
                className="mt-1 size-5"
                label={
                    <span className="block min-w-0 space-y-1 pl-1">
                        <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                            <Typography component="span" level="body2" semiBold>
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
                        <span className="flex items-start gap-2 text-sm font-normal text-muted-foreground">
                            <MapPin className="mt-0.5 size-4 shrink-0" />
                            <span>{order.address}</span>
                        </span>
                        {order.requestNotes ? (
                            <span className="flex items-start gap-2 text-sm font-normal text-amber-800 dark:text-amber-200">
                                <Leaf className="mt-0.5 size-4 shrink-0" />
                                <span>{order.requestNotes}</span>
                            </span>
                        ) : null}
                    </span>
                }
            />
        </div>
    );
}
