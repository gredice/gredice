import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export type SystemActivityInput = {
    source: 'vercel' | 'github';
    type: string;
    occurredAt: Date;
    eventCount: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function stringValue(record: Record<string, unknown>, key: string) {
    const value = record[key];
    return typeof value === 'string' ? value : null;
}

function numberValue(record: Record<string, unknown>, key: string) {
    const value = record[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function nestedRecord(record: Record<string, unknown>, key: string) {
    const value = record[key];
    return isRecord(value) ? value : null;
}

function normalizeSignature(signature: string, algorithm: 'sha1' | 'sha256') {
    const prefix = `${algorithm}=`;
    return signature.startsWith(prefix)
        ? signature.slice(prefix.length)
        : signature;
}

export function verifyWebhookSignature(
    rawBody: string,
    signature: string,
    secret: string,
    algorithm: 'sha1' | 'sha256',
) {
    const supplied = normalizeSignature(signature.trim(), algorithm);
    const expected = createHmac(algorithm, secret)
        .update(rawBody)
        .digest('hex');

    if (supplied.length !== expected.length) {
        return false;
    }

    return timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}

function vercelActivityType(log: Record<string, unknown>) {
    const source = stringValue(log, 'source');
    const level = stringValue(log, 'level');
    const directStatus = numberValue(log, 'statusCode');
    const proxyStatus = nestedRecord(log, 'proxy');
    const statusCode =
        directStatus ??
        (proxyStatus ? numberValue(proxyStatus, 'statusCode') : null);

    if (
        level === 'error' ||
        level === 'fatal' ||
        (statusCode !== null && statusCode >= 500)
    ) {
        return 'vercel.error';
    }

    if (source === 'build') {
        return 'vercel.build';
    }

    if (source === 'firewall') {
        return 'vercel.guard';
    }

    if (source === 'lambda' || source === 'edge') {
        return 'vercel.function';
    }

    if (source === 'static' || source === 'external' || source === 'redirect') {
        return 'vercel.request';
    }

    return null;
}

function parseJson(rawBody: string): unknown {
    return JSON.parse(rawBody);
}

export function parseVercelDrain(rawBody: string): SystemActivityInput[] {
    const value = parseJson(rawBody);
    const logs = Array.isArray(value) ? value : [value];
    const buckets = new Map<string, SystemActivityInput>();

    for (const log of logs.slice(0, 10_000)) {
        if (!isRecord(log)) {
            continue;
        }

        const type = vercelActivityType(log);
        const timestamp = numberValue(log, 'timestamp');
        if (!type || timestamp === null) {
            continue;
        }

        const occurredAt = new Date(Math.floor(timestamp / 60_000) * 60_000);
        if (Number.isNaN(occurredAt.getTime())) {
            continue;
        }

        const key = `${type}:${occurredAt.toISOString()}`;
        const existing = buckets.get(key);
        if (existing) {
            existing.eventCount += 1;
        } else {
            buckets.set(key, {
                source: 'vercel',
                type,
                occurredAt,
                eventCount: 1,
            });
        }
    }

    return [...buckets.values()];
}

function githubActivityType(
    eventName: string,
    payload: Record<string, unknown>,
) {
    const action = stringValue(payload, 'action');

    if (eventName === 'push') {
        return 'github.push';
    }

    if (eventName === 'pull_request') {
        const pullRequest = nestedRecord(payload, 'pull_request');
        if (action === 'closed' && pullRequest && pullRequest.merged === true) {
            return 'github.merge';
        }

        if (
            action === 'opened' ||
            action === 'reopened' ||
            action === 'ready_for_review' ||
            action === 'synchronize' ||
            action === 'closed'
        ) {
            return 'github.pull_request';
        }
    }

    if (eventName === 'pull_request_review' && action === 'submitted') {
        return 'github.review';
    }

    if (eventName === 'workflow_run' && action === 'completed') {
        const workflow = nestedRecord(payload, 'workflow_run');
        return workflow && stringValue(workflow, 'conclusion') === 'success'
            ? 'github.workflow.success'
            : 'github.workflow.failure';
    }

    if (eventName === 'deployment_status') {
        const deploymentStatus = nestedRecord(payload, 'deployment_status');
        const state = deploymentStatus
            ? stringValue(deploymentStatus, 'state')
            : null;
        if (state === 'success') {
            return 'github.deployment.success';
        }

        if (state === 'failure' || state === 'error') {
            return 'github.deployment.failure';
        }
    }

    if (
        eventName === 'release' &&
        (action === 'published' ||
            action === 'released' ||
            action === 'prereleased')
    ) {
        return 'github.release';
    }

    if (
        eventName === 'issues' &&
        (action === 'opened' || action === 'closed' || action === 'reopened')
    ) {
        return 'github.issue';
    }

    return null;
}

export function parseGithubWebhook(
    eventName: string,
    rawBody: string,
    receivedAt = new Date(),
): SystemActivityInput[] {
    const value = parseJson(rawBody);
    if (!isRecord(value)) {
        return [];
    }

    const type = githubActivityType(eventName, value);
    return type
        ? [
              {
                  source: 'github',
                  type,
                  occurredAt: receivedAt,
                  eventCount: 1,
              },
          ]
        : [];
}

export function privateDeliveryId(source: string, deliveryId: string) {
    return createHash('sha256')
        .update(`${source}:${deliveryId}`)
        .digest('base64url');
}
