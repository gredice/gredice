import type {
    DeliveryRunExceptionOutcome,
    DeliveryRunExceptionReason,
    InsertNotification,
} from '@gredice/storage';
import type {
    DeliveryLifecycleEvent,
    DeliveryLifecycleMilestone,
} from './deliveryLifecycle';

export type { DeliveryLifecycleMilestone } from './deliveryLifecycle';

export const customerDeliveryTrackerOrigin = 'https://dostava.gredice.com';
export const customerDeliveryNotificationWebPushTtlSeconds = 24 * 60 * 60;

export const customerDeliveryNotificationLimits = {
    actionLabelCharacters: 32,
    bodyCharacters: 240,
    requestIdCharacters: 128,
    titleCharacters: 64,
} as const;

export type CustomerDeliveryNotificationCopy = {
    actionLabel: string;
    body: string;
    title: string;
};

export type CustomerDeliveryNotificationContent =
    CustomerDeliveryNotificationCopy & {
        milestone: DeliveryLifecycleMilestone;
        trackerUrl: string;
    };

export type CustomerDeliveryNotificationEvent =
    | {
          exception?: never;
          milestone: Exclude<DeliveryLifecycleMilestone, 'exception'>;
          requestId: string;
      }
    | {
          exception: {
              outcome: DeliveryRunExceptionOutcome;
              reason: DeliveryRunExceptionReason;
          };
          milestone: 'exception';
          requestId: string;
      };

export const customerDeliveryNotificationCatalog = {
    'route-started': {
        actionLabel: 'Prati dostavu',
        body: 'Tvoj je urod preuzet i uključen u dostavnu rutu. Prati status dostave u aplikaciji.',
        title: 'Urod je uključen u dostavnu rutu',
    },
    'near-arrival': {
        actionLabel: 'Prati dostavu',
        body: 'Vozač se približava odredištu tvoje dostave. Prati aktualni status dostave.',
        title: 'Vozač je blizu',
    },
    'next-stop': {
        actionLabel: 'Prati dostavu',
        body: 'Tvoja je dostava sljedeća na ruti. Pripremi se za preuzimanje uroda.',
        title: 'Tvoja dostava je sljedeća',
    },
    delayed: {
        actionLabel: 'Prati dostavu',
        body: 'Dostava kasni u odnosu na planirano vrijeme. Prati ažurirani status u aplikaciji.',
        title: 'Dostava kasni',
    },
    arrived: {
        actionLabel: 'Prikaži dostavu',
        body: 'Vozač je stigao na odredište tvoje dostave. Preuzmi svoj urod.',
        title: 'Vozač je stigao',
    },
    delivered: {
        actionLabel: 'Prikaži dostavu',
        body: 'Tvoj je urod označen kao dostavljen.',
        title: 'Urod je dostavljen',
    },
    exception: {
        actionLabel: 'Prikaži dostavu',
        body: 'Dogodila se promjena u dostavi. Otvori dostavu za trenutačni status.',
        title: 'Promjena u dostavi',
    },
    recovery: {
        actionLabel: 'Prati dostavu',
        body: 'Planiran je novi pokušaj dostave. Prati aktualni status u aplikaciji.',
        title: 'Dostava se nastavlja',
    },
} as const satisfies Record<
    DeliveryLifecycleMilestone,
    CustomerDeliveryNotificationCopy
>;

const customerDeliveryExceptionReasonCopy = {
    'customer-unavailable': 'Vozač te nije uspio kontaktirati.',
    'address-inaccessible': 'Pristup odredištu trenutačno nije moguć.',
    'address-wrong': 'Adresu dostave treba provjeriti.',
    'harvest-damaged': 'Urod nije moguće sigurno uručiti.',
    'harvest-missing': 'Urod nije bio dostupan za uručenje.',
    cancellation: 'Dostava je otkazana.',
    'operational-other': 'Pojavila se poteškoća u dostavi.',
} as const satisfies Record<DeliveryRunExceptionReason, string>;

const customerDeliveryExceptionOutcomeCopy = {
    deferred: {
        bodySuffix: 'Planirat ćemo novi pokušaj i obavijestiti te.',
        title: 'Dostava je odgođena',
    },
    failed: {
        bodySuffix: 'Otvori dostavu za trenutačni status.',
        title: 'Dostava nije uspjela',
    },
    cancelled: {
        bodySuffix: 'Otvori dostavu za trenutačni status.',
        title: 'Dostava je otkazana',
    },
} as const satisfies Record<
    DeliveryRunExceptionOutcome,
    { bodySuffix: string; title: string }
>;

function hasOwnKey<T extends object>(
    value: T,
    key: PropertyKey,
): key is keyof T {
    return Object.hasOwn(value, key);
}

function assertBoundedCopy(copy: CustomerDeliveryNotificationCopy) {
    if (
        copy.title.length === 0 ||
        copy.title.length > customerDeliveryNotificationLimits.titleCharacters
    ) {
        throw new Error('Customer delivery notification title is invalid.');
    }
    if (
        copy.body.length === 0 ||
        copy.body.length > customerDeliveryNotificationLimits.bodyCharacters
    ) {
        throw new Error('Customer delivery notification body is invalid.');
    }
    if (
        copy.actionLabel.length === 0 ||
        copy.actionLabel.length >
            customerDeliveryNotificationLimits.actionLabelCharacters
    ) {
        throw new Error(
            'Customer delivery notification action label is invalid.',
        );
    }
}

export function isCustomerDeliveryRequestId(
    requestId: unknown,
): requestId is string {
    return (
        typeof requestId === 'string' &&
        requestId.length > 0 &&
        requestId.length <=
            customerDeliveryNotificationLimits.requestIdCharacters &&
        /^[A-Za-z0-9][A-Za-z0-9._:~-]*$/u.test(requestId)
    );
}

function assertOpaqueRequestId(
    requestId: unknown,
): asserts requestId is string {
    if (!isCustomerDeliveryRequestId(requestId)) {
        throw new Error('requestId must be a bounded opaque identifier.');
    }
}

export function buildCustomerDeliveryTrackerLink(requestId: string) {
    assertOpaqueRequestId(requestId);
    const trackerUrl = new URL(customerDeliveryTrackerOrigin);
    trackerUrl.searchParams.set('delivery', requestId);
    return trackerUrl.toString();
}

export function customerDeliveryExceptionCopy(exception: {
    outcome: DeliveryRunExceptionOutcome;
    reason: DeliveryRunExceptionReason;
}): CustomerDeliveryNotificationCopy {
    if (
        !hasOwnKey(customerDeliveryExceptionOutcomeCopy, exception.outcome) ||
        !hasOwnKey(customerDeliveryExceptionReasonCopy, exception.reason)
    ) {
        throw new Error('Delivery exception copy requires bounded values.');
    }
    const outcome = customerDeliveryExceptionOutcomeCopy[exception.outcome];
    const reason = customerDeliveryExceptionReasonCopy[exception.reason];
    const copy = {
        actionLabel: customerDeliveryNotificationCatalog.exception.actionLabel,
        body: `${reason} ${outcome.bodySuffix}`,
        title: outcome.title,
    };
    assertBoundedCopy(copy);
    return copy;
}

export function customerDeliveryNotificationCopy(
    event: CustomerDeliveryNotificationEvent,
): CustomerDeliveryNotificationCopy {
    const copy =
        event.milestone === 'exception'
            ? customerDeliveryExceptionCopy(event.exception)
            : customerDeliveryNotificationCatalog[event.milestone];
    assertBoundedCopy(copy);
    return { ...copy };
}

export function createCustomerDeliveryNotificationContent(
    event: CustomerDeliveryNotificationEvent,
): CustomerDeliveryNotificationContent {
    return {
        ...customerDeliveryNotificationCopy(event),
        milestone: event.milestone,
        trackerUrl: buildCustomerDeliveryTrackerLink(event.requestId),
    };
}

export function customerDeliveryLifecycleNotification(
    event: DeliveryLifecycleEvent,
    recipientUserId: string,
): InsertNotification {
    const userId = recipientUserId.trim();
    if (!userId) {
        throw new Error('Delivery lifecycle recipient user ID is required.');
    }
    const content = createCustomerDeliveryNotificationContent(event);
    return {
        accountId: event.accountId,
        actionLabel: content.actionLabel,
        actionUrl: content.trackerUrl,
        category: 'delivery_updates',
        collapseKey: `delivery:${event.requestId}:${event.milestone}:${event.retryAttempt}`,
        content: content.body,
        header: content.title,
        linkUrl: content.trackerUrl,
        metadata: {
            eventVersion: event.eventVersion,
            ...(event.milestone === 'exception'
                ? { exception: event.exception }
                : {}),
            milestone: event.milestone,
            requestId: event.requestId,
            retryAttempt: event.retryAttempt,
            runId: event.runId,
            source: {
                id: event.source.id,
                kind: event.source.kind,
                version: event.source.version,
            },
            stopId: event.stopId,
        },
        primaryChannel: 'in_app',
        priority:
            event.milestone === 'arrived' || event.milestone === 'exception'
                ? 'high'
                : 'normal',
        safeLinkUrl: content.trackerUrl,
        threadKey: `delivery:${event.requestId}`,
        timestamp: new Date(event.occurredAt),
        ttlSeconds: customerDeliveryNotificationWebPushTtlSeconds,
        type: 'delivery_lifecycle',
        userId,
    };
}

export function customerDeliveryLifecycleRecipientIdempotencyKey(
    event: DeliveryLifecycleEvent,
    recipientUserId: string,
) {
    const userId = recipientUserId.trim();
    if (!userId) {
        throw new Error('Delivery lifecycle recipient user ID is required.');
    }
    return `${event.idempotencyKey}:recipient:${encodeURIComponent(userId)}`;
}
