import type { ReactNode } from 'react';
import {
    formatDeliveryDate,
    formatDeliveryTime,
} from './deliverySlotFormatting';

export type NextOpenSlot = {
    startAt: string;
    endAt: string;
    location?: { name: string };
};

export function NextOpenSlotItem({
    icon,
    label,
    slot,
    showLocation,
}: {
    icon: ReactNode;
    label: string;
    slot: NextOpenSlot;
    showLocation?: boolean;
}) {
    return (
        <div className="rounded-lg border bg-card p-4 text-card-foreground">
            <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                {icon}
                {label}
            </dt>
            <dd className="mt-1 font-semibold">
                <time dateTime={slot.startAt}>
                    {formatDeliveryDate(slot.startAt, {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                    })}
                    , {formatDeliveryTime(slot.startAt)}
                </time>{' '}
                –{' '}
                <time dateTime={slot.endAt}>
                    {formatDeliveryTime(slot.endAt)}
                </time>
                {showLocation && slot.location ? (
                    <span className="block text-sm font-normal text-muted-foreground">
                        {slot.location.name}
                    </span>
                ) : null}
            </dd>
        </div>
    );
}
