import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createGardenStructureTemplateSeed } from '@gredice/js/gardenStructures';
import type { GardenStructureBuildSession } from '../useGameState';
import {
    createSavedGardenStructureEditorState,
    type GardenStructureEditorState,
} from './editor';
import { getMatchingGardenStructureConflictSession } from './gardenStructureConflictSession';

function createConflictSession() {
    const seed = createGardenStructureTemplateSeed('house');
    const created = createSavedGardenStructureEditorState({
        document: seed.document,
        gardenId: 42,
        kitKey: seed.kitKey,
        kitVersion: seed.kitVersion,
        placement: { anchorX: 3, anchorY: 4, rotation: 0 },
        refundablePrincipal: 200,
        revision: 3,
        structureId: 'house-1',
        sunflowerPricePerCell: 50,
        templateKey: seed.templateKey,
    });
    if (!created.ok) {
        throw new Error(created.error.message);
    }
    const editor = {
        ...created.value,
        save: {
            status: 'conflict',
            operation: 'placement',
            operationId: 'placement-1',
            expectedRevision: 3,
            actualRevision: 4,
            submittedSnapshot: created.value.snapshot,
        },
    } satisfies GardenStructureEditorState;
    return {
        category: 'structure',
        editor,
        persistence: 'remote',
        roofCutaway: false,
        selectedPartId: null,
    } satisfies GardenStructureBuildSession;
}

describe('getMatchingGardenStructureConflictSession', () => {
    const identity = {
        gardenId: 42,
        operationId: 'placement-1',
        structureId: 'house-1',
    };

    test('returns only the still-active conflict operation', () => {
        const session = createConflictSession();
        assert.equal(
            getMatchingGardenStructureConflictSession(session, identity),
            session,
        );
        assert.equal(
            getMatchingGardenStructureConflictSession(session, {
                ...identity,
                operationId: 'placement-2',
            }),
            null,
        );
    });

    test('ignores a completed exit or a replacement session', () => {
        const session = createConflictSession();
        assert.equal(
            getMatchingGardenStructureConflictSession(null, identity),
            null,
        );
        assert.equal(
            getMatchingGardenStructureConflictSession(session, {
                ...identity,
                structureId: 'house-2',
            }),
            null,
        );
    });
});
