import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { resolveGardenStructureMutationConflictRevision } from './gardenStructureMutationRecovery';

describe('resolveGardenStructureMutationConflictRevision', () => {
    test('keeps a newer server revision for saved-structure conflicts', () => {
        assert.equal(
            resolveGardenStructureMutationConflictRevision({
                code: 'REVISION_CONFLICT',
                currentRevision: 4,
                originKind: 'saved-structure',
            }),
            4,
        );
    });

    test('represents a deleted saved base as a conflict without a revision', () => {
        assert.equal(
            resolveGardenStructureMutationConflictRevision({
                code: 'STRUCTURE_NOT_FOUND',
                currentRevision: null,
                originKind: 'saved-structure',
            }),
            null,
        );
    });

    test('does not turn create or ordinary rejection failures into conflicts', () => {
        assert.equal(
            resolveGardenStructureMutationConflictRevision({
                code: 'STRUCTURE_NOT_FOUND',
                currentRevision: null,
                originKind: 'new-draft',
            }),
            undefined,
        );
        assert.equal(
            resolveGardenStructureMutationConflictRevision({
                code: 'INVALID_DOCUMENT',
                currentRevision: null,
                originKind: 'saved-structure',
            }),
            undefined,
        );
    });
});
