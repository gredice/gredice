import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    AutumnActivityRequestError,
    getAutumnActivityState,
    readStoredAutumnActivityCommand,
    submitAutumnActivityAction,
} from '../src/autumn-activity';

const command = {
    operationId: randomUUID(),
    expectedAccountId: randomUUID(),
    campaignId: 'album',
    campaignVersionId: `autumn-activity:v1:${'a'.repeat(64)}`,
    action: { kind: 'claim-welcome' } satisfies { kind: 'claim-welcome' },
};
const purchaseId = randomUUID();
const receipt = {
    operationId: command.operationId,
    accountId: command.expectedAccountId,
    campaignId: command.campaignId,
    campaignVersionId: command.campaignVersionId,
    progress: {
        discoveredMotifIds: [],
        completed: false,
        welcomePurchaseId: purchaseId,
        completionPurchaseId: null,
    },
    granted: [{ kind: 'welcome', purchaseId }],
    chargedSunflowers: 0,
    replayed: false,
};
async function withFetch(
    payload: unknown,
    status: number,
    run: () => Promise<void>,
) {
    const previous = globalThis.fetch;
    globalThis.fetch = async () => Response.json(payload, { status });
    try {
        await run();
    } finally {
        globalThis.fetch = previous;
    }
}
test('durable activity parser accepts captured command and rejects untrusted substitutions', () => {
    assert.deepEqual(readStoredAutumnActivityCommand(command), command);
    for (const value of [
        null,
        { ...command, expectedAccountId: 'other' },
        { ...command, reward: 'fake' },
        { ...command, action: { kind: 'claim-completion' } },
    ])
        assert.equal(readStoredAutumnActivityCommand(value), null);
});
test('activity receipt validates owner, operation, version, grant kind and zero value', async () => {
    await withFetch(receipt, 200, async () =>
        assert.deepEqual(await submitAutumnActivityAction(command), receipt),
    );
    for (const invalid of [
        null,
        { ...receipt, accountId: randomUUID() },
        { ...receipt, operationId: randomUUID() },
        {
            ...receipt,
            campaignVersionId: `autumn-activity:v1:${'b'.repeat(64)}`,
        },
        { ...receipt, chargedSunflowers: 1 },
        { ...receipt, granted: [{ kind: 'completion', purchaseId }] },
    ])
        await withFetch(invalid, 200, async () =>
            assert.rejects(
                submitAutumnActivityAction(command),
                (error) =>
                    error instanceof AutumnActivityRequestError &&
                    error.uncertain,
            ),
        );
});
test('auth/owner changes, timeout/rate limit and failed responses preserve uncertainty; explicit business conflict is definitive', async () => {
    for (const [status, code, uncertain] of [
        [401, 'UNAUTHORIZED', true],
        [403, 'FORBIDDEN', true],
        [408, 'TIMEOUT', true],
        [429, 'RATE_LIMIT', true],
        [503, 'ACTIVITY_FAILED', true],
        [409, 'EXPECTED_ACCOUNT_MISMATCH', true],
        [409, 'OPERATION_CONFLICT', false],
        [400, 'UNKNOWN_MOTIF', false],
    ] satisfies [number, string, boolean][])
        await withFetch({ code, error: 'Failed' }, status, async () =>
            assert.rejects(
                submitAutumnActivityAction(command),
                (error) =>
                    error instanceof AutumnActivityRequestError &&
                    error.uncertain === uncertain &&
                    error.serverDefinitive === !uncertain,
            ),
        );
    const previous = globalThis.fetch;
    globalThis.fetch = async () => {
        throw new Error('Lost response');
    };
    try {
        await assert.rejects(
            submitAutumnActivityAction(command),
            (error) =>
                error instanceof AutumnActivityRequestError && error.uncertain,
        );
    } finally {
        globalThis.fetch = previous;
    }
});
test('read helper rejects contradictory private progress and readiness', async () => {
    const state = {
        enabled: false,
        accountId: command.expectedAccountId,
        campaign: null,
        progress: null,
        eventStatus: null,
        actionAvailable: false,
        readiness: 'disabled',
    };
    await withFetch(state, 200, async () =>
        assert.deepEqual(await getAutumnActivityState(), state),
    );
    await withFetch({ ...state, actionAvailable: true }, 200, async () =>
        assert.rejects(getAutumnActivityState()),
    );
});
