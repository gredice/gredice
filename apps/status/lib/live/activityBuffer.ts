import 'server-only';
import {
    type ActivityDelivery,
    decodeActivityDelivery,
    FLUSH_BATCH_SIZE,
    MAX_DELIVERY_BYTES,
    MAX_PENDING_AGE_MS,
    MAX_PENDING_DELIVERIES,
} from './activityDelivery';

// No TTL on pending work: a worker outage never silently discards accepted data.
// Capacity and age stop new admissions instead. Lua preserves concurrent dedup.
export const enqueueActivityScript = `
local function remember()
    if #KEYS == 3 then redis.call('SET', KEYS[3], ARGV[6], 'EX', 604800) end
end
if #KEYS == 3 then
    local admitted = redis.call('GET', KEYS[3])
    if admitted and tonumber(admitted) >= tonumber(ARGV[6]) then return 'duplicate' end
    if tonumber(ARGV[6]) ~= tonumber(admitted or '-1') + 1 then
        return redis.error_reply('Activity admission cursor is out of order')
    end
end
if redis.call('HEXISTS', KEYS[1], ARGV[1]) == 1 then
    remember()
    return 'duplicate'
end
if redis.call('HLEN', KEYS[1]) >= tonumber(ARGV[4]) then return 'full' end
local oldest = redis.call('ZRANGE', KEYS[2], 0, 0, 'WITHSCORES')
if #oldest > 0 and tonumber(ARGV[3]) - tonumber(oldest[2]) >= tonumber(ARGV[5]) then
    return 'stale'
end
redis.call('HSET', KEYS[1], ARGV[1], ARGV[2])
local indexed = redis.pcall('ZADD', KEYS[2], ARGV[3], ARGV[1])
if type(indexed) == 'table' and indexed.err then
    redis.call('HDEL', KEYS[1], ARGV[1])
    return redis.error_reply('Activity buffer index write failed')
end
remember()
return 'buffered'
`;

export const readActivityScript = `
local ids = redis.call('ZRANGE', KEYS[2], 0, tonumber(ARGV[2]) - 1)
if #ids == 0 then return {'empty'} end
local owner = redis.call('GET', KEYS[3])
if owner and owner ~= ARGV[1] then return {'busy'} end
redis.call('SET', KEYS[3], ARGV[1], 'PX', 60000)
local result = {'ready'}
for _, id in ipairs(ids) do
    local payload = redis.call('HGET', KEYS[1], id)
    if not payload then return redis.error_reply('Invalid activity buffer index') end
    table.insert(result, payload)
end
return result
`;

export const acknowledgeActivityScript = `
if redis.call('GET', KEYS[3]) ~= ARGV[1] then return 0 end
for i = 2, #ARGV do
    redis.call('HDEL', KEYS[1], ARGV[i])
    redis.call('ZREM', KEYS[2], ARGV[i])
end
return 1
`;

export const releaseActivityScript = `
if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end
return 0
`;

export type ActivityBuffer = ReturnType<typeof createActivityBuffer>;

export function activityBufferPrefix(
    environment: Record<string, string | undefined> = process.env,
) {
    const deploymentEnvironment = environment.VERCEL_ENV || 'development';
    const deployment =
        deploymentEnvironment === 'preview'
            ? `:${environment.VERCEL_URL || 'local'}`
            : '';
    return `${environment.GREDICE_LIVE_BUFFER_PREFIX?.trim() || 'status-live'}:${deploymentEnvironment}${deployment}:v1`;
}

export function createActivityBuffer(
    credentials: { url: string; token: string; prefix: string },
    send = fetch,
) {
    const endpoint = new URL(credentials.url);
    if (endpoint.protocol !== 'https:') {
        throw new Error('Activity buffer requires HTTPS.');
    }
    const keys = [
        `${credentials.prefix}:pending`,
        `${credentials.prefix}:order`,
        `${credentials.prefix}:flush`,
    ];

    async function evaluate(
        script: string,
        scriptKeys: string[],
        args: (string | number)[],
    ) {
        const response = await send(endpoint, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${credentials.token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify([
                'EVAL',
                script,
                scriptKeys.length,
                ...scriptKeys,
                ...args,
            ]),
            cache: 'no-store',
            signal: AbortSignal.timeout(5_000),
        });
        if (!response.ok) throw new Error('Activity buffer request failed.');
        const value: unknown = await response.json();
        if (
            typeof value !== 'object' ||
            value === null ||
            !('result' in value) ||
            ('error' in value && value.error)
        ) {
            throw new Error('Activity buffer returned an invalid response.');
        }
        return value.result;
    }

    return {
        async enqueue(delivery: ActivityDelivery) {
            const raw = JSON.stringify(delivery);
            // Enforce both byte and semantic bounds before the durable write.
            decodeActivityDelivery(raw);
            if (Buffer.byteLength(raw, 'utf8') > MAX_DELIVERY_BYTES) {
                throw new Error('Activity delivery exceeds the buffer limit.');
            }
            const result = await evaluate(
                enqueueActivityScript,
                delivery.admission
                    ? [
                          ...keys.slice(0, 2),
                          `${credentials.prefix}:admission:${delivery.admission.parentId}`,
                      ]
                    : keys.slice(0, 2),
                [
                    delivery.id,
                    raw,
                    Date.parse(delivery.receivedAt),
                    MAX_PENDING_DELIVERIES,
                    MAX_PENDING_AGE_MS,
                    delivery.admission?.index ?? -1,
                ],
            );
            if (result === 'buffered' || result === 'duplicate') return result;
            if (result === 'full' || result === 'stale') return result;
            throw new Error(
                'Activity buffer returned an invalid admission result.',
            );
        },
        async read(token: string) {
            const result = await evaluate(readActivityScript, keys, [
                token,
                FLUSH_BATCH_SIZE,
            ]);
            if (!Array.isArray(result))
                throw new Error('Invalid activity buffer batch.');
            const [status, ...payloads] = result;
            if (status === 'empty' || status === 'busy')
                return { status, deliveries: [] };
            if (status !== 'ready' || payloads.length > FLUSH_BATCH_SIZE) {
                throw new Error('Invalid activity buffer batch.');
            }
            const deliveries = payloads.map((payload: unknown) => {
                if (typeof payload !== 'string')
                    throw new Error('Invalid activity buffer payload.');
                return decodeActivityDelivery(payload);
            });
            return { status: 'ready', deliveries };
        },
        async acknowledge(token: string, ids: string[]) {
            const result = await evaluate(acknowledgeActivityScript, keys, [
                token,
                ...ids,
            ]);
            if (result !== 1)
                throw new Error('Activity buffer flush lease expired.');
        },
        async release(token: string) {
            await evaluate(releaseActivityScript, keys.slice(2), [token]);
        },
    };
}

export function configuredActivityBuffer() {
    const url = process.env.GREDICE_LIVE_BUFFER_REST_API_URL?.trim();
    const token = process.env.GREDICE_LIVE_BUFFER_REST_API_TOKEN?.trim();
    return url && token
        ? createActivityBuffer({ url, token, prefix: activityBufferPrefix() })
        : null;
}
