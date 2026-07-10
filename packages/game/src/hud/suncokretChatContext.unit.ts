import assert from 'node:assert/strict';
import test from 'node:test';
import { sanitizeSuncokretAssistantText } from '@gredice/js/ai';
import {
    estimateSuncokretTextTokens,
    formatSuncokretTokenUsage,
    resolveSuncokretUiContext,
    resolveSuncokretVisibleUsage,
    suncokretConversationLabel,
    suncokretUsageFromMetadata,
} from './suncokretChatContext';

test('settings context takes precedence over the raised-bed closeup', () => {
    assert.deepStrictEqual(
        resolveSuncokretUiContext({
            raisedBedName: 'Sunčano Sunce',
            settingsSection: 'igra',
        }),
        { surface: 'settings', section: 'igra' },
    );
    assert.strictEqual(
        suncokretConversationLabel({
            gardenName: 'Aleksov vrt',
            raisedBedName: 'Sunčano Sunce',
            settingsSection: 'igra',
        }),
        'postavke igre',
    );
});

test('raised-bed and garden contexts use the visible entity name', () => {
    assert.deepStrictEqual(
        resolveSuncokretUiContext({ raisedBedName: 'Sunčano Sunce' }),
        { surface: 'raised-bed' },
    );
    assert.strictEqual(
        suncokretConversationLabel({
            gardenName: 'Aleksov vrt',
            raisedBedName: 'Sunčano Sunce',
        }),
        'Sunčano Sunce',
    );
    assert.strictEqual(
        suncokretConversationLabel({ gardenName: 'Aleksov vrt' }),
        'Aleksov vrt',
    );
});

test('token usage metadata supports exact totals and a live text estimate', () => {
    assert.deepStrictEqual(
        suncokretUsageFromMetadata({
            suncokret: {
                requestId: 'request-1',
                usage: { totalTokens: 1_234 },
            },
        }),
        { requestId: 'request-1', totalTokens: 1_234 },
    );
    assert.strictEqual(estimateSuncokretTextTokens('12345678'), 2);
    assert.deepStrictEqual(
        resolveSuncokretVisibleUsage({
            dailyUsageTokens: 1_234,
            streamingText: '12345678',
        }),
        { approximate: true, tokens: 1_236 },
    );
    assert.match(formatSuncokretTokenUsage(1_234, true), /^Danas korišteno ≈/);
});

test('provider tool protocol variants are replaced with a friendly retry message', () => {
    for (const protocol of [
        '<｜｜DSML｜｜tool_calls>\n<｜｜DSML｜｜invoke name="searchDirectory">',
        '< | | DSML | | tool_calls> < | | DSML | | invoke name="getRaisedBedDetails">',
    ]) {
        const sanitized = sanitizeSuncokretAssistantText(
            `Provjeravam podatke.\n${protocol}`,
        );

        assert.doesNotMatch(sanitized, /DSML|searchDirectory|RaisedBedDetails/);
        assert.match(sanitized, /Provjeravam podatke\./);
        assert.match(sanitized, /Pokušaj ponovno/);
    }
});
