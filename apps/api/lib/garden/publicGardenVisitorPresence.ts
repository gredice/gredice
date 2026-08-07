import { redisCacheClient } from '@gredice/storage';
import { z } from 'zod';

const presenceLifetimeMs = 15_000;
const presenceKeyLifetimeSeconds = 30;
const maximumVisibleVisitors = 16;
let lastPresenceWarningAt = Number.NEGATIVE_INFINITY;

const avatarPositionSchema = z.tuple([
    z.number().finite().min(-10_000).max(10_000),
    z.number().finite().min(-1_000).max(10_000),
    z.number().finite().min(-10_000).max(10_000),
]);

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
                visitorId: z.string().uuid(),
                yaw: z.number().finite().min(-Math.PI).max(Math.PI),
            })
            .strict(),
        z
            .object({
                action: z.literal('leave'),
                visitorId: z.string().uuid(),
            })
            .strict(),
    ],
);

const storedPublicGardenVisitorSchema = z
    .object({
        crouchAmount: z.number(),
        grounded: z.boolean(),
        headPitch: z.number(),
        id: z.string().uuid(),
        movingSpeed: z.number(),
        position: avatarPositionSchema,
        updatedAt: z.number().int(),
        view: z.enum(['overview', 'third-person', 'first-person']),
        yaw: z.number(),
    })
    .strict();

export type PublicGardenVisitorPresence = z.infer<
    typeof storedPublicGardenVisitorSchema
>;

function presenceKey(gardenId: number) {
    return `public-garden:${gardenId.toString()}:visitors:v1`;
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
        return { live: false, visitors: [] };
    }

    const now = Date.now();
    const key = presenceKey(gardenId);
    const { action: _, visitorId, ...avatar } = presence;
    const storedPresence: PublicGardenVisitorPresence = {
        ...avatar,
        id: visitorId,
        updatedAt: now,
    };

    try {
        await client.hset(key, { [visitorId]: storedPresence });
        await client.expire(key, presenceKeyLifetimeSeconds);
        const entries = await client.hgetall<Record<string, unknown>>(key);
        const selected = selectActivePublicGardenVisitors({
            entries,
            now,
            visitorId,
        });
        if (selected.staleVisitorIds.length > 0) {
            await client.hdel(key, ...selected.staleVisitorIds);
        }
        return { live: true, visitors: selected.visitors };
    } catch (error) {
        if (Date.now() - lastPresenceWarningAt >= 60_000) {
            lastPresenceWarningAt = Date.now();
            console.warn('Unable to update public garden visitor presence', {
                error,
                gardenId,
            });
        }
        return { live: false, visitors: [] };
    }
}

export async function removePublicGardenVisitorPresence({
    gardenId,
    visitorId,
}: {
    gardenId: number;
    visitorId: string;
}) {
    const client = redisCacheClient('gredice');
    if (!client) {
        return;
    }

    try {
        await client.hdel(presenceKey(gardenId), visitorId);
    } catch (error) {
        console.warn('Unable to remove public garden visitor presence', {
            error,
            gardenId,
        });
    }
}
