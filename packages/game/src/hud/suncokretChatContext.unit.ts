import assert from 'node:assert/strict';
import test from 'node:test';
import { sanitizeSuncokretAssistantText } from '@gredice/js/ai';
import {
    estimateSuncokretTextTokens,
    formatSuncokretTokenUsage,
    resolveSuncokretUiContext,
    resolveSuncokretVisibleUsage,
    suncokretContextConversationLabel,
    suncokretContextSuggestions,
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

test('contextual surfaces use distinct labels and suggestions', () => {
    assert.strictEqual(
        suncokretContextConversationLabel({
            uiContext: { surface: 'weather', view: 'forecast' },
        }),
        'vremensku prognozu',
    );
    assert.strictEqual(
        suncokretContextConversationLabel({
            plantName: 'Kupus bijeli',
            uiContext: { surface: 'plant-details', tab: 'diary' },
        }),
        'dnevnik biljke "Kupus bijeli"',
    );

    const diarySuggestions = suncokretContextSuggestions({
        surface: 'raised-bed-details',
        tab: 'diary',
    });
    const operationSuggestions = suncokretContextSuggestions({
        surface: 'raised-bed-details',
        tab: 'operations',
    });
    assert.match(diarySuggestions[0]?.label ?? '', /dnevnik/i);
    assert.match(operationSuggestions[0]?.label ?? '', /radnje/i);
    assert.notDeepStrictEqual(diarySuggestions, operationSuggestions);

    const plantPrompts = [
        'lifecycle' as const,
        'diary' as const,
        'operations' as const,
    ].map(
        (tab) =>
            suncokretContextSuggestions({
                surface: 'plant-details',
                tab,
            })[0]?.prompt,
    );
    assert.strictEqual(new Set(plantPrompts).size, 3);
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
