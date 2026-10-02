import { createHash } from 'node:crypto';
import type { SystemActivityInput } from './ingestParsers';
import { privateDeliveryId } from './ingestParsers';

export const MAX_DELIVERY_BYTES = 16 * 1024;
export const MAX_DELIVERY_EVENTS = 128;
export const MAX_PENDING_DELIVERIES = 2048;
export const MAX_PENDING_AGE_MS = 24 * 60 * 60 * 1000;
export const FLUSH_BATCH_SIZE = 50;
export const MAX_FLUSH_BATCHES = 10;

const activityTypes = new Set([
    'vercel.error',
    'vercel.build',
    'vercel.guard',
    'vercel.function',
    'vercel.request',
    'github.push',
    'github.merge',
    'github.pull_request',
    'github.review',
    'github.workflow.success',
    'github.workflow.failure',
    'github.deployment.success',
    'github.deployment.failure',
    'github.release',
    'github.issue',
]);

export type ActivityDelivery = {
    id: string;
    source: SystemActivityInput['source'];
    receivedAt: string;
    events: {
        id: string;
        source: SystemActivityInput['source'];
        type: string;
        occurredAt: string;
        eventCount: number;
    }[];
};

export function activityDelivery(
    source: SystemActivityInput['source'],
    deliveryId: string,
    events: SystemActivityInput[],
    receivedAt = new Date(),
): ActivityDelivery {
    return {
        id: privateDeliveryId(source, deliveryId),
        source,
        receivedAt: receivedAt.toISOString(),
        events: events.map((event) => {
            const occurredAt = new Date(
                Math.floor(event.occurredAt.getTime() / 60_000) * 60_000,
            ).toISOString();
            return {
                id: createHash('sha256')
                    .update(`${event.source}:${event.type}:${occurredAt}`)
                    .digest('base64url'),
                source: event.source,
                type: event.type,
                occurredAt,
                eventCount: event.eventCount,
            };
        }),
    };
}

function record(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function privateId(value: unknown): value is string {
    return typeof value === 'string' && /^[\w-]{43}$/u.test(value);
}

function timestamp(value: unknown): value is string {
    return (
        typeof value === 'string' &&
        Number.isFinite(Date.parse(value)) &&
        new Date(value).toISOString() === value
    );
}

// The durable buffer is a separate trust boundary. Copy only sanitized fields.
export function decodeActivityDelivery(raw: string): ActivityDelivery {
    if (Buffer.byteLength(raw, 'utf8') > MAX_DELIVERY_BYTES) {
        throw new Error('Activity delivery exceeds the buffer limit.');
    }
    const value: unknown = JSON.parse(raw);
    if (
        !record(value) ||
        !privateId(value.id) ||
        (value.source !== 'vercel' && value.source !== 'github') ||
        !timestamp(value.receivedAt) ||
        !Array.isArray(value.events) ||
        value.events.length > MAX_DELIVERY_EVENTS
    ) {
        throw new Error('Invalid buffered activity delivery.');
    }
    const source = value.source;
    const events: ActivityDelivery['events'] = value.events.map(
        (event: unknown) => {
            if (
                !record(event) ||
                !privateId(event.id) ||
                event.source !== source ||
                typeof event.type !== 'string' ||
                !activityTypes.has(event.type) ||
                !event.type.startsWith(`${source}.`) ||
                !timestamp(event.occurredAt) ||
                typeof event.eventCount !== 'number' ||
                !Number.isSafeInteger(event.eventCount) ||
                event.eventCount <= 0 ||
                event.eventCount > 2147483647
            ) {
                throw new Error('Invalid buffered activity event.');
            }
            return {
                id: event.id,
                source,
                type: event.type,
                occurredAt: event.occurredAt,
                eventCount: event.eventCount,
            };
        },
    );
    return { id: value.id, source, receivedAt: value.receivedAt, events };
}
