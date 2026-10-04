import { AsyncLocalStorage } from 'node:async_hooks';
import { Redis } from '@upstash/redis';
import { createUpstashRedisRequester } from './cache/upstashRedisRequester';

export const dueWorkJobs = [
    'automations',
    'order-confirmation-emails',
    'checkout-notifications',
    'delivery-lifecycle-emails',
    'delivery-lifecycle-reconciliation',
    'stripe-checkout-orphan-recovery',
    'social-publishing',
] as const;
export type DueWorkJob = (typeof dueWorkJobs)[number];

const commitSignals = new AsyncLocalStorage<Map<DueWorkJob, number>>();
const signalScript = `
local generation = redis.call('HINCRBY', KEYS[1], 'generation', 1)
local due = redis.call('HGET', KEYS[1], 'dueAt')
if not due or tonumber(ARGV[1]) < tonumber(due) then
    redis.call('HSET', KEYS[1], 'dueAt', ARGV[1])
end
return generation
`;
const acknowledgeScript = `
local generation = redis.call('HGET', KEYS[1], 'generation') or '0'
if generation ~= ARGV[1] then return 0 end
redis.call('HSET', KEYS[1], 'generation', generation, 'checkedAt', ARGV[3])
if ARGV[2] == '' then redis.call('HDEL', KEYS[1], 'dueAt')
else redis.call('HSET', KEYS[1], 'dueAt', ARGV[2]) end
return 1
`;

function signalKey(job: DueWorkJob) {
    const environment = process.env.VERCEL_ENV ?? 'local';
    const revision =
        environment === 'production'
            ? ''
            : (process.env.VERCEL_GIT_COMMIT_SHA ?? '');
    return `due-work:v1:${environment}:${revision}:${job}`;
}

function signalClient() {
    const url = process.env.GREDICE_SILO_KV_REST_API_URL;
    const token = process.env.GREDICE_SILO_KV_REST_API_TOKEN;
    if (!url || !token) return null;
    const client = new Redis({
        url,
        token,
        retry: false,
        signal: () => AbortSignal.timeout(1_500),
        enableAutoPipelining: false,
    });
    const requester = createUpstashRedisRequester({ url, token, retry: false });
    client.use((request) => requester.request(request));
    return client;
}

function recordSignal(
    signals: Map<DueWorkJob, number>,
    job: DueWorkJob,
    dueAt: number,
) {
    signals.set(job, Math.min(signals.get(job) ?? Infinity, dueAt));
}

async function publishSignal(job: DueWorkJob, dueAt: number) {
    try {
        const client = signalClient();
        if (client) await client.eval(signalScript, [signalKey(job)], [dueAt]);
    } catch (error) {
        // A successful commit must never look failed because its hint failed.
        // Durable work stays in PostgreSQL for the bounded recovery scan.
        console.warn('Due-work signal publication failed', {
            job,
            errorName: error instanceof Error ? error.name : 'Unknown',
        });
    }
}

export async function signalDueWork(job: DueWorkJob, dueAt = new Date()) {
    const signals = commitSignals.getStore();
    if (signals) {
        recordSignal(signals, job, dueAt.getTime());
    } else {
        await publishSignal(job, dueAt.getTime());
    }
}

// Domain events written outside createEvent still feed the runner's durable
// cursor. Preserve prompt discovery of Admin-configured event automations.
export async function signalAutomationEventWrite<T>(write: PromiseLike<T>) {
    const result = await write;
    await signalDueWork('automations');
    return result;
}

// Each transaction gets its own scope: a rollback discards its hints, and a
// nested success merges into the outer scope instead of publishing early.
export async function withDueWorkCommitSignals<T>(
    run: () => Promise<T>,
    publish = publishSignal,
): Promise<T> {
    const outer = commitSignals.getStore();
    const signals = new Map<DueWorkJob, number>();
    const result = await commitSignals.run(signals, run);
    if (outer) {
        for (const [job, dueAt] of signals) recordSignal(outer, job, dueAt);
    } else {
        await Promise.all(
            [...signals].map(async ([job, dueAt]) => {
                try {
                    await publish(job, dueAt);
                } catch (error) {
                    console.warn('Due-work signal publication failed', {
                        job,
                        errorName:
                            error instanceof Error ? error.name : 'Unknown',
                    });
                }
            }),
        );
    }
    return result;
}

export async function readDueWorkSignal(job: DueWorkJob) {
    const client = signalClient();
    if (!client) return null;
    const signal = await client.hgetall<{
        generation?: number;
        dueAt?: number;
        checkedAt?: number;
    }>(signalKey(job));
    const result = {
        generation: Number(signal?.generation ?? 0),
        dueAt: signal?.dueAt === undefined ? null : Number(signal.dueAt),
        checkedAt: Number(signal?.checkedAt ?? 0),
    };
    return Number.isSafeInteger(result.generation) &&
        result.generation >= 0 &&
        Number.isFinite(result.checkedAt) &&
        (result.dueAt === null || Number.isFinite(result.dueAt))
        ? result
        : null;
}

export async function acknowledgeDueWork(
    job: DueWorkJob,
    generation: number,
    nextDueAt: Date | null,
    checkedAt = new Date(),
) {
    const client = signalClient();
    if (!client) return false;
    return (
        (await client.eval(
            acknowledgeScript,
            [signalKey(job)],
            [generation, nextDueAt?.getTime() ?? '', checkedAt.getTime()],
        )) === 1
    );
}
