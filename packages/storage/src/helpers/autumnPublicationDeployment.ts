import { createHash } from 'node:crypto';
import type { AutumnPublicationPlan } from './autumnPublicationPlan';
import { publicationDigest } from './autumnPublicationPlan';

type Observation = { url: string; sha256: string; bytes: number };
const verified = new WeakMap<
    object,
    {
        planDigest: string;
        startedAt: number;
        verifiedAt: number;
        observations: Observation[];
    }
>();
export type VerifiedAutumnDeployment = {
    planDigest: string;
    verifiedAt: number;
    observations: Observation[];
};
/** Actual bounded byte reads; submitted booleans/hash claims cannot mint this proof. */
export async function verifyAutumnPublicationDeployment(
    plan: AutumnPublicationPlan,
    read: typeof fetch = fetch,
): Promise<VerifiedAutumnDeployment> {
    const urls = new Set<string>();
    for (const asset of plan.deployedAssets) {
        const url = new URL(asset.url);
        const garden = asset.path.startsWith('apps/garden/public/assets/');
        const prefix = garden ? 'apps/garden/public' : 'apps/www/public';
        if (
            (!garden && !asset.path.startsWith('apps/www/public/assets/')) ||
            url.origin !==
                (garden
                    ? 'https://vrt.gredice.com'
                    : 'https://www.gredice.com') ||
            url.pathname !== asset.path.slice(prefix.length) ||
            url.username ||
            url.password ||
            url.hash ||
            // Some reviewed legacy scenery uses a named version (Tree), while
            // new pilot models use twelve hash characters. Exact query identity
            // comes from authoritative source reconstruction in the CLI.
            (url.search && !/^\?v=[a-zA-Z0-9._:-]{1,100}$/.test(url.search)) ||
            urls.has(url.href)
        )
            throw new Error(`Unreviewed/duplicate deployed URL: ${asset.url}`);
        urls.add(url.href);
    }
    const startedAt = Date.now();
    const overall = AbortSignal.timeout(120_000);
    const cancel = new AbortController();
    const observations: Observation[] = new Array(plan.deployedAssets.length);
    let cursor = 0;
    async function worker() {
        while (cursor < plan.deployedAssets.length) {
            overall.throwIfAborted();
            cancel.signal.throwIfAborted();
            const index = cursor++;
            const asset = plan.deployedAssets[index];
            const signal = AbortSignal.any([
                overall,
                cancel.signal,
                AbortSignal.timeout(10_000),
            ]);
            const response = await read(asset.url, {
                redirect: 'error',
                cache: 'no-store',
                signal,
            });
            signal.throwIfAborted();
            if (!response.ok || !response.body)
                throw new Error(`Deployed byte read failed: ${asset.url}`);
            const length = response.headers.get('content-length');
            if (
                length !== null &&
                (!/^\d+$/.test(length) || Number(length) !== asset.bytes)
            ) {
                await response.body.cancel();
                throw new Error(`Deployed byte size differs: ${asset.url}`);
            }
            const reader = response.body.getReader();
            const hash = createHash('sha256');
            let bytes = 0;
            try {
                while (true) {
                    signal.throwIfAborted();
                    const chunk = await reader.read();
                    if (chunk.done) break;
                    bytes += chunk.value.byteLength;
                    if (bytes > asset.bytes || bytes > 50_000_000)
                        throw new Error(
                            `Deployed byte size exceeded: ${asset.url}`,
                        );
                    hash.update(chunk.value);
                }
            } finally {
                await reader.cancel();
                reader.releaseLock();
            }
            const digest = hash.digest('hex');
            if (bytes !== asset.bytes || digest !== asset.sha256)
                throw new Error(`Deployed byte hash differs: ${asset.url}`);
            observations[index] = { url: asset.url, sha256: digest, bytes };
        }
    }
    const workers = Array.from(
        { length: Math.min(4, plan.deployedAssets.length) },
        worker,
    );
    try {
        await Promise.all(workers);
    } catch (error) {
        cancel.abort();
        await Promise.allSettled(workers);
        throw error;
    }
    overall.throwIfAborted();
    const proof = {
        planDigest: publicationDigest(plan),
        verifiedAt: Date.now(),
        observations,
    };
    verified.set(proof, {
        planDigest: proof.planDigest,
        startedAt,
        verifiedAt: proof.verifiedAt,
        observations: structuredClone(observations),
    });
    return proof;
}
export function assertVerifiedAutumnDeployment(
    plan: AutumnPublicationPlan,
    proof: VerifiedAutumnDeployment,
) {
    const original = verified.get(proof);
    if (
        !original ||
        original.planDigest !== publicationDigest(plan) ||
        proof.planDigest !== original.planDigest ||
        proof.verifiedAt !== original.verifiedAt ||
        Date.now() - original.startedAt > 300_000 ||
        original.startedAt > Date.now()
    )
        throw new Error('Fresh actual deployment byte proof required');
}
export function verifiedAutumnDeploymentObservations(
    plan: AutumnPublicationPlan,
    proof: VerifiedAutumnDeployment,
) {
    assertVerifiedAutumnDeployment(plan, proof);
    const original = verified.get(proof);
    if (!original) throw new Error('Missing deployment verification');
    return structuredClone(original.observations);
}
