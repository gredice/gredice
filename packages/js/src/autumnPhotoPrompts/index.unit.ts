import assert from 'node:assert/strict';
import test from 'node:test';
import { autumnPhotoPrompts, getAutumnPhotoFilename } from './index';

test('optional photo filenames contain only the selected public prompt, never caller identifiers', () => {
    assert.deepEqual(
        autumnPhotoPrompts.map((prompt) => prompt.title),
        ['Moja jesenska gredica', 'Pod svjetlom fenjera', 'Prvi list'],
    );
    for (const prompt of autumnPhotoPrompts)
        assert.match(getAutumnPhotoFilename(prompt.id), /^[a-z-]+\.png$/u);
    assert.throws(() => getAutumnPhotoFilename('../private-account'));
});
