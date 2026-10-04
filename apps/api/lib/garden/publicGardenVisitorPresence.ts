import { createHash, randomUUID } from 'node:crypto';
import { redisCacheClient } from '@gredice/storage';
import { z } from 'zod';

const presenceLifetimeMs = 15_000;
const presenceKeyLifetimeSeconds = 30;
const maximumStoredVisitors = 32;
const maximumVisibleVisitors = 16;
const maximumRequestsPerAddressPerSecond = 48;
let lastPresenceWarningAt = Number.NEGATIVE_INFINITY;

const avatarPositionSchema = z.tuple([
    z.number().finite().min(-10_000).max(10_000),
    z.number().finite().min(-1_000).max(10_000),
    z.number().finite().min(-10_000).max(10_000),
]);
const visitorIdSchema = z.string().uuid();
const visitorCapabilitySchema = z.string().uuid();

export const publicGardenVisitorPresenceBodySchema = z.discriminatedUnion(
    'action',
    [
        z
            .object({
                action: z.literal('presence'),
                crouchAmount: z.number().finite().min(0).max(1),
                grounded: z.boolean(),
                headPitch: z
                    .number()
                    .finite()
                    .min(-Math.PI / 2)
                    .max(Math.PI / 2),
                movingSpeed: z.number().finite().min(0).max(10),
                position: avatarPositionSchema,
                view: z.enum(['overview', 'third-person', 'first-person']),
                visitorCapability: visitorCapabilitySchema.optional(),
                visitorId: visitorIdSchema,
                yaw: z.number().finite().min(-Math.PI).max(Math.PI),
            })
            .strict(),
        z
            .object({
                action: z.literal('leave'),
                visitorCapability: visitorCapabilitySchema,
                visitorId: visitorIdSchema,
            })
            .strict(),
    ],
);

const storedPublicGardenVisitorSchema = z
    .object({
        crouchAmount: z.number(),
        grounded: z.boolean(),
        headPitch: z.number(),
        id: visitorIdSchema,
        movingSpeed: z.number(),
        position: avatarPositionSchema,
        updatedAt: z.number().int(),
        view: z.enum(['overview', 'third-person', 'first-person']),
        yaw: z.number(),
    })
    .strict();

const storedVisitorEntrySchema = z
    .object({
        capabilityHash: z.string().regex(/^[0-9a-f]{64}$/),
        visitor: storedPublicGardenVisitorSchema,
    })
    .strict();

export type PublicGardenVisitorPresence = z.infer<
    typeof storedPublicGardenVisitorSchema
>;

function presenceIndexKey(gardenId: number) {
    return `public-garden:${gardenId.toString()}:visitors:v2`;
}

function presenceEntryKey(gardenId: number, visitorId: string) {
    return `${presenceIndexKey(gardenId)}:${visitorId}`;
}

function capabilityHash(capability: string) {
    return createHash('sha256').update(capability).digest('hex');
}

function parseStoredPresence(value: unknown) {
    if (typeof value !== 'string') {
        return storedPublicGardenVisitorSchema.safeParse(value);
    }

    try {
        return storedPublicGardenVisitorSchema.safeParse(JSON.parse(value));
    } catch {
        return storedPublicGardenVisitorSchema.safeParse(null);
    }
}

function parseStoredEntry(value: unknown) {
    if (typeof value !== 'string') {
        return storedVisitorEntrySchema.safeParse(value);
    }

    try {
        return storedVisitorEntrySchema.safeParse(JSON.parse(value));
    } catch {
        return storedVisitorEntrySchema.safeParse(null);
    }
}

function warnPresenceFailure(
    message: string,
    details: Record<string, unknown>,
) {
    if (Date.now() - lastPresenceWarningAt < 60_000) {
        return;
    }
    lastPresenceWarningAt = Date.now();
    console.warn(message, details);
}

export function publicGardenVisitorClientAddress(headers: {
    get(name: string): string | null | undefined;
}) {
    const headerValue = (name: string, position: 'first' | 'last') => {
        const values = headers
            .get(name)
            ?.split(',')
            .map((value) => value.trim())
            .filter(Boolean);
        return position === 'first' ? values?.[0] : values?.at(-1);
    };

    return (
        headerValue('x-vercel-forwarded-for', 'first') ??
        headerValue('x-forwarded-for', 'last') ??
        'unknown'
    );
}

export async function publicGardenVisitorRateLimitAllows(
    clientAddress: string,
) {
    const client = redisCacheClient('gredice');
    if (!client) {
        return true;
    }

    const addressHash = createHash('sha256')
        .update(clientAddress)
        .digest('hex')
        .slice(0, 24);
    const bucket = Math.floor(Date.now() / 1_000).toString();
    const key = `public-garden-visitors:rate:v1:${addressHash}:${bucket}`;

    try {
        const requestCount = await client.incr(key);
        await client.expire(key, 2);
        return requestCount <= maximumRequestsPerAddressPerSecond;
    } catch (error) {
        warnPresenceFailure('Unable to rate limit public garden visitors', {
            error,
        });
        return false;
    }
}

export function selectActivePublicGardenVisitors({
    entries,
    now,
    visitorId,
}: {
    entries: Record<string, unknown> | null;
    now: number;
    visitorId: string;
}) {
    const staleVisitorIds: string[] = [];
    const visitors: PublicGardenVisitorPresence[] = [];

    for (const [entryId, value] of Object.entries(entries ?? {})) {
        const parsed = parseStoredPresence(value);
        if (
            !parsed.success ||
            parsed.data.id !== entryId ||
            parsed.data.updatedAt < now - presenceLifetimeMs
        ) {
            staleVisitorIds.push(entryId);
            continue;
        }
        if (entryId !== visitorId) {
            visitors.push(parsed.data);
        }
    }

    visitors.sort((left, right) => right.updatedAt - left.updatedAt);
    return {
        staleVisitorIds,
        visitors: visitors.slice(0, maximumVisibleVisitors),
    };
}

async function readActiveVisitors({
    gardenId,
    now,
    visitorId,
}: {
    gardenId: number;
    now: number;
    visitorId: string;
}) {
    const client = redisCacheClient('gredice');
    if (!client) {
        return [];
    }

    const indexKey = presenceIndexKey(gardenId);
    const visitorIds = await client.zrange<string[]>(
        indexKey,
        0,
        maximumVisibleVisitors,
        { rev: true },
    );
    if (visitorIds.length === 0) {
        return [];
    }

    const storedEntries = await client.mget<unknown[]>(
        ...visitorIds.map((id) => presenceEntryKey(gardenId, id)),
    );
    const entries: Record<string, unknown> = {};
    for (const [index, id] of visitorIds.entries()) {
        const parsed = parseStoredEntry(storedEntries[index]);
        entries[id] = parsed.success ? parsed.data.visitor : null;
    }
    const selected = selectActivePublicGardenVisitors({
        entries,
        now,
        visitorId,
    });
    if (selected.staleVisitorIds.length > 0) {
        await client.zrem(indexKey, ...selected.staleVisitorIds);
    }
    return selected.visitors;
}

export async function updatePublicGardenVisitorPresence({
    gardenId,
    presence,
}: {
    gardenId: number;
    presence: Extract<
        z.infer<typeof publicGardenVisitorPresenceBodySchema>,
        { action: 'presence' }
    >;
}) {
    const client = redisCacheClient('gredice');
    if (!client) {
        return { status: 'unavailable' as const };
    }

    const now = Date.now();
    const indexKey = presenceIndexKey(gardenId);
    const entryKey = presenceEntryKey(gardenId, presence.visitorId);
    try {
        const existing = parseStoredEntry(await client.get(entryKey));
        if (
            existing.success &&
            (!presence.visitorCapability ||
                capabilityHash(presence.visitorCapability) !==
                    existing.data.capabilityHash)
        ) {
            return { status: 'unauthorized' as const };
        }

        const visitorCapability = presence.visitorCapability ?? randomUUID();
        const {
            action: _,
            visitorCapability: __,
            visitorId,
            ...avatar
        } = presence;
        const visitor: PublicGardenVisitorPresence = {
            ...avatar,
            id: visitorId,
            updatedAt: now,
        };

        await client.set(
            entryKey,
            {
                capabilityHash: capabilityHash(visitorCapability),
                visitor,
            },
            { ex: presenceKeyLifetimeSeconds },
        );
        await client.zadd(indexKey, { member: visitorId, score: now });
        await client.zremrangebyscore(
            indexKey,
            '-inf',
            now - presenceLifetimeMs - 1,
        );
        await client.zremrangebyrank(indexKey, 0, -(maximumStoredVisitors + 1));
        await client.expire(indexKey, presenceKeyLifetimeSeconds);

        return {
            live: true,
            status: 'ok' as const,
            visitorCapability,
            visitors: await readActiveVisitors({
                gardenId,
                now,
                visitorId,
            }),
        };
    } catch (error) {
        warnPresenceFailure('Unable to update public garden visitor presence', {
            error,
            gardenId,
        });
        return { status: 'unavailable' as const };
    }
}

export async function removePublicGardenVisitorPresence({
    gardenId,
    visitorCapability,
    visitorId,
}: {
    gardenId: number;
    visitorCapability: string;
    visitorId: string;
}) {
    const client = redisCacheClient('gredice');
    if (!client) {
        return { status: 'unavailable' as const };
    }

    const entryKey = presenceEntryKey(gardenId, visitorId);
    try {
        const existing = parseStoredEntry(await client.get(entryKey));
        if (!existing.success) {
            return { status: 'removed' as const };
        }
        if (
            capabilityHash(visitorCapability) !== existing.data.capabilityHash
        ) {
            return { status: 'unauthorized' as const };
        }

        await Promise.all([
            client.del(entryKey),
            client.zrem(presenceIndexKey(gardenId), visitorId),
        ]);
        return { status: 'removed' as const };
    } catch (error) {
        warnPresenceFailure('Unable to remove public garden visitor presence', {
            error,
            gardenId,
        });
        return { status: 'unavailable' as const };
    }
}
