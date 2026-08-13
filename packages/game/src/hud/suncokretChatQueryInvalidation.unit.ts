import assert from 'node:assert/strict';
import test from 'node:test';
import { suncokretMutationQueryKeys } from './suncokretChatQueryInvalidation';

function messageWith(...parts: Record<string, unknown>[]) {
    return { parts };
}

test('completed shopping-cart tools refresh the cart and tutorial queries once', () => {
    assert.deepStrictEqual(
        suncokretMutationQueryKeys({
            message: messageWith(
                {
                    type: 'tool-addProductToCart',
                    state: 'output-available',
                },
                {
                    type: 'tool-updateCartItem',
                    state: 'output-available',
                },
            ),
        }),
        [['shopping-cart'], ['accounts', 'current', 'tutorial-checklist']],
    );
});

test('approval, denial, and error states do not refresh mutation queries', () => {
    for (const state of [
        'approval-requested',
        'approval-responded',
        'output-denied',
        'output-error',
    ]) {
        assert.deepStrictEqual(
            suncokretMutationQueryKeys({
                message: messageWith({
                    type: 'tool-addOperationToCart',
                    state,
                }),
            }),
            [],
        );
    }
});

test('raised-bed image analysis refreshes the related diary and AI history', () => {
    assert.deepStrictEqual(
        suncokretMutationQueryKeys({
            fallbackRaisedBedId: 11,
            message: messageWith({
                type: 'tool-analyzeRaisedBedImages',
                state: 'output-available',
                input: {},
            }),
        }),
        [
            ['raisedBeds', 11, 'diary'],
            ['raisedBeds', 11, 'ai-history'],
        ],
    );

    assert.deepStrictEqual(
        suncokretMutationQueryKeys({
            fallbackRaisedBedId: 11,
            message: messageWith({
                type: 'tool-analyzeRaisedBedImages',
                state: 'output-available',
                input: { raisedBedId: 12 },
            }),
        }),
        [
            ['raisedBeds', 12, 'diary'],
            ['raisedBeds', 12, 'ai-history'],
        ],
    );
});

test('read-only and presentation tools leave cached data alone', () => {
    assert.deepStrictEqual(
        suncokretMutationQueryKeys({
            message: messageWith(
                {
                    type: 'tool-getCart',
                    state: 'output-available',
                },
                {
                    type: 'dynamic-tool',
                    toolName: 'listGardenOperations',
                    state: 'output-available',
                },
                {
                    type: 'tool-presentRecommendations',
                    state: 'output-available',
                },
            ),
        }),
        [],
    );
});
