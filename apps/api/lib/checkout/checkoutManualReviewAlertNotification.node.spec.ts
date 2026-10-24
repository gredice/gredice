import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mock, test } from 'node:test';

type SlackPostMessageInput = {
    channel?: string;
    text: string;
    beforeProviderSubmission?: () => Promise<void>;
};
const slackModule = createRequire(
    import.meta.resolve('@gredice/notifications'),
).resolve('@gredice/slack');

process.env.SLACK_BOT_TOKEN = 'synthetic-test-token';
const actualStorage = await import('@gredice/storage');
let captured: SlackPostMessageInput | undefined;
const providerResponse = {
    ok: false,
    outcome: 'rejected' as const,
    status: 429,
    error: 'raw-provider-details-must-not-be-logged',
    response: { privatePayload: 'synthetic-private-provider-payload' },
};
mock.module('@gredice/storage', {
    namedExports: {
        ...actualStorage,
        getNotificationSetting: async (key: string) => {
            assert.equal(key, 'slack.shopping.channel');
            return {
                enabled: 'true',
                integrationType: 'slack',
                config: { channelId: 'C_SYNTHETIC_OPERATOR' },
            };
        },
    },
});
mock.module(slackModule, {
    namedExports: {
        postMessage: async (input: SlackPostMessageInput) => {
            captured = input;
            await input.beforeProviderSubmission?.();
            return providerResponse;
        },
    },
});
const { deliverStripePaymentManualReviewAlert } = await import(
    '@gredice/notifications'
);

test('operator notification uses configured channel and submission fence without logging provider payloads', async (t) => {
    const logs: unknown[][] = [];
    t.mock.method(console, 'error', (...args: unknown[]) => {
        logs.push(args);
    });
    let fenced = false;
    const response = await deliverStripePaymentManualReviewAlert(
        {
            paymentClaimId: 5454,
            reviewCycleId: 7,
            failureCategory: 'checkout_operation_conflict',
        },
        {
            beforeProviderSubmission: async () => {
                fenced = true;
            },
        },
    );
    assert.equal(response, providerResponse);
    assert.equal(fenced, true);
    assert.equal(captured?.channel, 'C_SYNTHETIC_OPERATOR');
    assert.equal(
        captured?.text,
        [
            ':rotating_light: *Plaćena narudžba zahtijeva ručnu provjeru*',
            '• Zahtjev: 5454',
            '• Ciklus provjere: 7',
            '• Kategorija: checkout_operation_conflict',
            '• Administracija: https://app.gredice.com/admin/shopping-carts',
        ].join('\n'),
    );
    assert.deepEqual(logs, []);
});

test('invalid alert context is rejected before provider submission', async () => {
    captured = undefined;
    await assert.rejects(
        deliverStripePaymentManualReviewAlert({
            paymentClaimId: 5454,
            reviewCycleId: 7,
            failureCategory: 'customer@example.test raw payload',
        }),
        TypeError,
    );
    assert.equal(captured, undefined);
});
