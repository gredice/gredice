import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { describe, it } from 'node:test';
import {
    parseGithubWebhook,
    parseVercelDrain,
    privateDeliveryId,
    verifyWebhookSignature,
} from './ingestParsers';

describe('live system activity ingestion', () => {
    it('verifies Vercel and GitHub signatures against the raw body', () => {
        const body = '{"activity":"quiet"}';
        const secret = 'test-secret';
        const vercelSignature = createHmac('sha1', secret)
            .update(body)
            .digest('hex');
        const githubSignature = `sha256=${createHmac('sha256', secret)
            .update(body)
            .digest('hex')}`;

        assert.equal(
            verifyWebhookSignature(body, vercelSignature, secret, 'sha1'),
            true,
        );
        assert.equal(
            verifyWebhookSignature(body, githubSignature, secret, 'sha256'),
            true,
        );
        assert.equal(
            verifyWebhookSignature(
                `${body} `,
                githubSignature,
                secret,
                'sha256',
            ),
            false,
        );
    });

    it('reduces Vercel logs to privacy-safe minute pulses', () => {
        const events = parseVercelDrain(
            JSON.stringify([
                {
                    source: 'lambda',
                    timestamp: Date.UTC(2026, 7, 16, 8, 31, 4),
                    message: 'private route and user details are ignored',
                },
                {
                    source: 'edge',
                    timestamp: Date.UTC(2026, 7, 16, 8, 31, 49),
                },
                {
                    source: 'static',
                    level: 'error',
                    timestamp: Date.UTC(2026, 7, 16, 8, 32, 1),
                },
                {
                    source: 'build',
                    timestamp: Date.UTC(2026, 7, 16, 8, 33, 1),
                },
                { source: 'unknown', timestamp: Date.now() },
            ]),
        );

        assert.deepEqual(
            events.map(({ type, eventCount, occurredAt }) => ({
                type,
                eventCount,
                occurredAt: occurredAt.toISOString(),
            })),
            [
                {
                    type: 'vercel.function',
                    eventCount: 2,
                    occurredAt: '2026-08-16T08:31:00.000Z',
                },
                {
                    type: 'vercel.error',
                    eventCount: 1,
                    occurredAt: '2026-08-16T08:32:00.000Z',
                },
                {
                    type: 'vercel.build',
                    eventCount: 1,
                    occurredAt: '2026-08-16T08:33:00.000Z',
                },
            ],
        );
    });

    it('keeps only allowlisted GitHub delivery states', () => {
        const receivedAt = new Date('2026-08-16T09:00:00.000Z');

        assert.equal(
            parseGithubWebhook('push', '{}', receivedAt)[0]?.type,
            'github.push',
        );
        assert.equal(
            parseGithubWebhook(
                'pull_request',
                JSON.stringify({
                    action: 'closed',
                    pull_request: { merged: true, title: 'never persisted' },
                }),
                receivedAt,
            )[0]?.type,
            'github.merge',
        );
        assert.equal(
            parseGithubWebhook(
                'workflow_run',
                JSON.stringify({
                    action: 'completed',
                    workflow_run: { conclusion: 'failure' },
                }),
                receivedAt,
            )[0]?.type,
            'github.workflow.failure',
        );
        assert.equal(
            parseGithubWebhook(
                'deployment_status',
                JSON.stringify({
                    deployment_status: { state: 'success' },
                }),
                receivedAt,
            )[0]?.type,
            'github.deployment.success',
        );
        assert.equal(
            parseGithubWebhook(
                'deployment_status',
                JSON.stringify({
                    deployment_status: { state: 'failure' },
                }),
                receivedAt,
            )[0]?.type,
            'github.deployment.failure',
        );
        assert.deepEqual(
            parseGithubWebhook(
                'deployment_status',
                JSON.stringify({
                    deployment_status: { state: 'pending' },
                }),
                receivedAt,
            ),
            [],
        );
        assert.deepEqual(parseGithubWebhook('ping', '{}', receivedAt), []);
    });

    it('hashes external delivery identifiers before storage', () => {
        const externalId = '72d3162e-cc78-11e3-81ab-4c9367dc0958';
        const privateId = privateDeliveryId('github', externalId);

        assert.notEqual(privateId, externalId);
        assert.equal(privateId, privateDeliveryId('github', externalId));
        assert.notEqual(privateId, privateDeliveryId('vercel', externalId));
    });
});
