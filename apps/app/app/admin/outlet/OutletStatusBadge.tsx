import type {
    OutletOfferReservationStatus,
    OutletOfferStatus,
} from '@gredice/storage';
import {
    outletOfferStatusLabels,
    outletReservationStatusLabels,
} from './format';

const offerStatusClassNames = {
    draft: 'bg-muted text-muted-foreground',
    published:
        'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200',
    paused: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
    closed: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
} satisfies Record<OutletOfferStatus, string>;

const reservationStatusClassNames = {
    held: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200',
    released:
        'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
    converted:
        'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200',
} satisfies Record<OutletOfferReservationStatus, string>;

export function OutletOfferStatusBadge({
    status,
}: {
    status: OutletOfferStatus;
}) {
    return (
        <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${offerStatusClassNames[status]}`}
        >
            {outletOfferStatusLabels[status]}
        </span>
    );
}

export function OutletReservationStatusBadge({
    status,
}: {
    status: OutletOfferReservationStatus;
}) {
    return (
        <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${reservationStatusClassNames[status]}`}
        >
            {outletReservationStatusLabels[status]}
        </span>
    );
}
