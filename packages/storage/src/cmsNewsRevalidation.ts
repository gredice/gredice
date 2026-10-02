import { randomUUID } from 'node:crypto';

export const maxNewsRevalidationSlugs = 8;
const maxPendingSlugs = 512;

export function isPublicNewsSlug(value: unknown): value is string {
    return (
        typeof value === 'string' &&
        value.length <= 200 &&
        /^novosti\/(?:[a-z0-9_-]+\/)*[a-z0-9_-]+$/u.test(value) &&
        value !== 'novosti/sto-je-novo'
    );
}

export function publicNewsSlugs(values: Iterable<unknown>) {
    return Array.from(new Set(Array.from(values).filter(isPublicNewsSlug)));
}

function queueConfig() {
    const url = process.env.GREDICE_NEWS_REVALIDATE_REST_API_URL;
    const token = process.env.GREDICE_NEWS_REVALIDATE_REST_API_TOKEN;
    if (!url || !token || new URL(url).protocol !== 'https:') {
        throw new Error('News revalidation retry storage is not configured.');
    }
    const environment = process.env.VERCEL_ENV || 'development';
    const key =
        process.env.GREDICE_NEWS_REVALIDATE_KEY?.trim() ||
        (environment === 'production'
            ? 'cms-news:production:revalidation:v1'
            : null);
    if (!key)
        throw new Error('News retry key must be explicit outside production.');
    return { url: url.replace(/\/+$/u, ''), token, key };
}

async function command(script: string, args: string[] = []) {
    const { url, token, key } = queueConfig();
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            authorization: `Bearer ${token}`,
            'content-type': 'application/json',
        },
        body: JSON.stringify(['EVAL', script, 1, key, ...args]),
        cache: 'no-store',
        signal: AbortSignal.timeout(5000),
    });
    if (!response.ok)
        throw new Error(`News retry storage HTTP ${response.status}.`);
    const payload: unknown = await response.json();
    if (
        !payload ||
        typeof payload !== 'object' ||
        !('result' in payload) ||
        'error' in payload
    ) {
        throw new Error('News retry storage command failed.');
    }
    return payload.result;
}

const enqueueScript = `
local newCount = 0
for i = 2, #ARGV do
  if redis.call('HEXISTS', KEYS[1], ARGV[i]) == 0 then newCount = newCount + 1 end
end
if redis.call('HLEN', KEYS[1]) + newCount > ${maxPendingSlugs} then return 0 end
for i = 2, #ARGV do redis.call('HSET', KEYS[1], ARGV[i], ARGV[1]) end
return 1`;

/** Only called after a failed request for a committed public-content mutation. */
export async function enqueueNewsRevalidation(slugs: string[]) {
    const safeSlugs = publicNewsSlugs(slugs);
    if (!safeSlugs.length) return;
    if (safeSlugs.length > maxNewsRevalidationSlugs)
        throw new Error('Too many News retry slugs.');
    if ((await command(enqueueScript, [randomUUID(), ...safeSlugs])) !== 1) {
        throw new Error('News revalidation retry storage is full.');
    }
}

export async function readPendingNewsRevalidations() {
    const result = await command(`return redis.call('HGETALL', KEYS[1])`);
    if (
        !Array.isArray(result) ||
        result.length > maxPendingSlugs * 2 ||
        result.length % 2
    ) {
        throw new Error('Invalid pending News revalidation data.');
    }
    const entries: { slug: string; token: string }[] = [];
    for (let i = 0; i < result.length; i += 2) {
        const slug: unknown = result[i];
        const token: unknown = result[i + 1];
        if (
            !isPublicNewsSlug(slug) ||
            typeof token !== 'string' ||
            token.length > 64
        ) {
            throw new Error('Invalid pending News revalidation item.');
        }
        entries.push({ slug, token });
    }
    return entries;
}

/** A concurrent failure replaces the token, so this acknowledgement cannot lose it. */
export async function acknowledgeNewsRevalidations(
    entries: { slug: string; token: string }[],
) {
    if (!entries.length) return;
    await command(
        `
for i = 1, #ARGV, 2 do
  if redis.call('HGET', KEYS[1], ARGV[i]) == ARGV[i+1] then
    redis.call('HDEL', KEYS[1], ARGV[i])
  end
end
return 1`,
        entries.flatMap(({ slug, token }) => [slug, token]),
    );
}
