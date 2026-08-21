import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRaisedBedAnalysisChatSeed } from './raisedBedAnalysisChatSeed';

test('buildRaisedBedAnalysisChatSeed opens the thread with the raised bed analysis', () => {
    const seed = buildRaisedBedAnalysisChatSeed({
        analysisMarkdown: '## Sažetak stanja\nSve izgleda dobro.',
        id: 'seed-1',
        referenceDate: new Date('2026-05-12T10:00:00.000Z'),
    });

    assert.strictEqual(seed.id, 'seed-1');
    assert.strictEqual(seed.messages.length, 1);
    assert.strictEqual(seed.messages[0]?.role, 'assistant');
    assert.match(
        seed.messages[0]?.text ?? '',
        /^Evo moje analize fotografija gredice od 12\. svibnja 2026\.:/,
    );
    assert.match(seed.messages[0]?.text ?? '', /Sve izgleda dobro\./);
    assert.strictEqual(seed.suggestions?.length, 3);
});

test('buildRaisedBedAnalysisChatSeed names the analyzed field with its visible label', () => {
    const seed = buildRaisedBedAnalysisChatSeed({
        analysisMarkdown: 'Analiza.',
        id: 'seed-2',
        positionIndex: 4,
        referenceDate: null,
    });

    assert.match(
        seed.messages[0]?.text ?? '',
        /^Evo moje analize fotografija polja 5:/,
    );
});

test('buildRaisedBedAnalysisChatSeed omits an unusable analysis date', () => {
    const seed = buildRaisedBedAnalysisChatSeed({
        analysisMarkdown: 'Analiza.',
        id: 'seed-3',
        referenceDate: 'not-a-date',
    });

    assert.match(
        seed.messages[0]?.text ?? '',
        /^Evo moje analize fotografija gredice:/,
    );
});
