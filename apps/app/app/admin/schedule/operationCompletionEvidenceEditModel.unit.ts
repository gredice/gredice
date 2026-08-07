import assert from 'node:assert/strict';
import test from 'node:test';
import { buildOperationCompletionEvidenceActionArguments } from './operationCompletionEvidenceEditModel';

test('completion evidence UI sends the rendered task version with edited evidence', () => {
    assert.deepEqual(
        buildOperationCompletionEvidenceActionArguments({
            operationId: 42,
            expectedTaskVersionEventId: 9102,
            imageUrls: ['https://cdn.gredice.com/completion.jpg'],
            notes: 'Pregledana napomena',
        }),
        [
            42,
            9102,
            ['https://cdn.gredice.com/completion.jpg'],
            'Pregledana napomena',
        ],
    );
});
