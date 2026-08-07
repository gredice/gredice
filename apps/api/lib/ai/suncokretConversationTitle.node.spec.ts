import assert from 'node:assert/strict';
import test from 'node:test';
import {
    fallbackSuncokretConversationTitle,
    firstSuncokretUserQuestion,
    normalizeSuncokretConversationTitle,
} from './suncokretConversationTitle';

test('extracts the first user question from UI message parts', () => {
    assert.strictEqual(
        firstSuncokretUserQuestion([
            { id: 'assistant-1', role: 'assistant', parts: [] },
            {
                id: 'user-1',
                role: 'user',
                parts: [
                    { type: 'text', text: '  Kako pripremiti ' },
                    { type: 'file', url: 'https://example.test/image.jpg' },
                    { type: 'text', text: 'vrt za kišu?  ' },
                ],
            },
        ]),
        'Kako pripremiti vrt za kišu?',
    );
});

test('normalizes generated titles and bounds their length', () => {
    assert.strictEqual(
        normalizeSuncokretConversationTitle(
            'Naslov: „Priprema vrta za kišu”\n',
            'Kako pripremiti vrt?',
        ),
        'Priprema vrta za kišu',
    );
    assert.ok(
        normalizeSuncokretConversationTitle('', 'a'.repeat(100)).length <= 72,
    );
    assert.strictEqual(
        fallbackSuncokretConversationTitle([
            {
                role: 'user',
                parts: [{ type: 'text', text: 'Kako pripremiti vrt?' }],
            },
        ]),
        'Kako pripremiti vrt?',
    );
});
