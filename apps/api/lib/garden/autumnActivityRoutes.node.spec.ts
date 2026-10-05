import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { createAutumnActivityRoutes } from '../../app/api/[...route]/autumnActivityRoutes';
import { autumnActivityFixtureCampaign } from './autumnActivityFixtures';

type Dependencies = NonNullable<
    Parameters<typeof createAutumnActivityRoutes>[0]
>;
const accountId = randomUUID();
const campaign = autumnActivityFixtureCampaign();
const command = () => ({
    operationId: randomUUID(),
    expectedAccountId: accountId,
    campaignId: campaign.id,
    campaignVersionId: campaign.versionId,
    action: { kind: 'claim-welcome' },
});
function dependencies(overrides: Partial<Dependencies> = {}): Dependencies {
    return {
        authValidator: () => async (context, next) => {
            context.set('authContext', {
                accountId,
                userId: 'fixture',
                user: {
                    id: 'fixture',
                    accountIds: [accountId],
                    isTemporary: false,
                    role: 'user',
                },
            });
            await next();
        },
        service: {
            getState: async (owner) => ({
                enabled: false,
                accountId: owner,
                campaign: null,
                progress: null,
                eventStatus: null,
                actionAvailable: false,
                readiness: 'disabled',
            }),
            act: async () => ({
                ok: false,
                code: 'ACTIVITY_DISABLED',
                error: 'Disabled',
                status: 503,
            }),
        },
        ...overrides,
    };
}
function request(json: unknown) {
    return {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(json),
    };
}
test('activity authentication precedes all private reads and mutations; responses no-store', async () => {
    const app = createAutumnActivityRoutes(
        dependencies({
            authValidator: () => async (context) =>
                context.json({ error: 'Unauthorized' }, 401),
            service: {
                getState: async () => assert.fail('Unauthorized read'),
                act: async () => assert.fail('Unauthorized mutation'),
            },
        }),
    );
    for (const response of [
        await app.request('/'),
        await app.request('/actions', request(command())),
    ]) {
        assert.equal(response.status, 401);
        assert.equal(
            response.headers.get('Cache-Control'),
            'private, no-store',
        );
    }
});
test('state reads use session owner, never a request owner', async () => {
    const app = createAutumnActivityRoutes(dependencies());
    const response = await app.request(`/?accountId=${randomUUID()}`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
    assert.equal((await response.json()).accountId, accountId);
});
test('strict activity body rejects substitutions and expected-owner mismatch before service', async () => {
    const app = createAutumnActivityRoutes(
        dependencies({
            service: {
                getState: async () => assert.fail('Unexpected read'),
                act: async () =>
                    assert.fail('Invalid mutation reached service'),
            },
        }),
    );
    assert.equal(
        (await app.request('/actions', request({ ...command(), accountId })))
            .status,
        400,
    );
    assert.equal(
        (
            await app.request(
                '/actions',
                request({ ...command(), expectedAccountId: randomUUID() }),
            )
        ).status,
        409,
    );
    assert.equal(
        (
            await app.request(
                '/actions',
                request({ ...command(), rewards: campaign.rewards }),
            )
        ).status,
        400,
    );
});
test('validated action passes authenticated owner and exposes actual retryable failure status', async () => {
    let calls = 0;
    const app = createAutumnActivityRoutes(
        dependencies({
            service: {
                ...dependencies().service,
                act: async (owner, input) => {
                    calls++;
                    assert.equal(owner, accountId);
                    assert.equal(input.expectedAccountId, accountId);
                    return {
                        ok: false,
                        code: 'ACTIVITY_DISABLED',
                        error: 'Disabled',
                        status: 503,
                    };
                },
            },
        }),
    );
    const response = await app.request('/actions', request(command()));
    assert.equal(response.status, 503);
    assert.equal(calls, 1);
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
});
