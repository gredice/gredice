import assert from 'node:assert/strict';
import test from 'node:test';
import type { UIMessage } from 'ai';
import { seedMessages } from '../suncokretChatUtils';
import {
    photoAnalysisAttachment,
    restoreAnalysisAttachments,
} from './photoAnalysisChat';
import { buildRaisedBedAnalysisChatSeed } from './raisedBedAnalysisChatSeed';

const attachment = {
    gardenId: 1,
    entryName: 'Fotografiranje gredice',
    imageUrls: ['/first.jpg', '/second.jpg'],
};
const seed = buildRaisedBedAnalysisChatSeed({
    id: 'analysis-501-user',
    analysisMarkdown: 'Grah raste.',
    analyzedAt: new Date('2026-09-22T12:00:00Z'),
    photoAnalysis: attachment,
});

test('analysis photos survive the message metadata JSON round trip', () => {
    const [message] = JSON.parse(JSON.stringify(seedMessages(seed)));
    assert.deepEqual(photoAnalysisAttachment(message.metadata), attachment);
    assert.equal(message.metadata.createdAt, '2026-09-22T12:00:00.000Z');
});

test('invalid photo metadata does not become an analysis attachment', () => {
    for (const value of [
        undefined,
        null,
        {},
        { ...attachment, gardenId: '1' },
        { ...attachment, gardenId: -1 },
        { ...attachment, gardenId: 1.5 },
        { ...attachment, entryName: null },
        { ...attachment, imageUrls: [1] },
    ]) {
        assert.equal(
            photoAnalysisAttachment({ photoAnalysis: value }),
            undefined,
        );
    }
});

test('legacy review history gains photos by seed ID without replacing saved messages', () => {
    const messages: UIMessage[] = [
        {
            id: 'analysis-501-user-0',
            role: 'assistant',
            metadata: { suncokret: { usage: { tokens: 12 } } },
            parts: [{ type: 'text', text: 'Spremljeni odgovor.' }],
        },
        {
            id: 'follow-up',
            role: 'user',
            parts: [{ type: 'text', text: 'A što sutra?' }],
        },
    ];
    const original = structuredClone(messages);
    const restored = restoreAnalysisAttachments(messages, seed);
    assert.deepEqual(restored[0]?.parts, messages[0]?.parts);
    assert.deepEqual(restored[0]?.metadata, {
        suncokret: { usage: { tokens: 12 } },
        createdAt: '2026-09-22T12:00:00.000Z',
        photoAnalysis: attachment,
    });
    assert.equal(restored[1], messages[1]);
    assert.deepEqual(messages, original);
    assert.equal(restoreAnalysisAttachments(messages), messages);
    assert.equal(
        restoreAnalysisAttachments(messages, { ...seed, id: 'other' })[0],
        messages[0],
    );
});
