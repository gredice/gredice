import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
    getGardenStructureEditorRecoveryStorageKey,
    readGardenStructureEditorDemolitionRecoveryPointer,
    readGardenStructureEditorRecoveryStorage,
    writeGardenStructureEditorDemolitionRecoveryPointer,
    writeGardenStructureEditorRecoveryStorage,
} from './gardenStructureEditorRecoveryStorage';

describe('garden structure editor recovery storage', () => {
    test('uses one versioned new-draft slot per garden and one slot per saved structure', () => {
        assert.equal(
            getGardenStructureEditorRecoveryStorageKey({
                gardenId: 42,
                kind: 'new-draft',
            }),
            'gredice:garden-structure-editor:v1:garden:42:new',
        );
        assert.equal(
            getGardenStructureEditorRecoveryStorageKey({
                gardenId: 42,
                kind: 'saved-structure',
                structureId: 'house/one',
                templateKey: 'house',
                kitKey: 'gredice-buildings',
                kitVersion: '1',
                revision: 1,
                sunflowerPricePerCell: 50,
                refundablePrincipal: 200,
                acknowledged: {
                    document: {
                        schemaVersion: 1,
                        footprint: { cells: [] },
                        floors: [],
                        edges: [],
                        roofRegions: [],
                        props: [],
                    },
                    placement: { anchorX: 0, anchorY: 0, rotation: 0 },
                },
            }),
            'gredice:garden-structure-editor:v1:garden:42:structure:house%2Fone',
        );
    });

    test('writes, clears, and fails closed when browser storage throws', () => {
        const values = new Map<string, string>();
        const storage = {
            getItem(key: string) {
                return values.get(key) ?? null;
            },
            removeItem(key: string) {
                values.delete(key);
            },
            setItem(key: string, value: string) {
                values.set(key, value);
            },
        };

        assert.equal(
            writeGardenStructureEditorRecoveryStorage(
                storage,
                'draft',
                '{"recoveryVersion":1}',
            ),
            true,
        );
        assert.equal(
            readGardenStructureEditorRecoveryStorage(storage, 'draft'),
            '{"recoveryVersion":1}',
        );
        assert.equal(
            writeGardenStructureEditorRecoveryStorage(storage, 'draft', null),
            true,
        );
        assert.equal(
            readGardenStructureEditorRecoveryStorage(storage, 'draft'),
            null,
        );

        const unavailable = {
            getItem() {
                throw new Error('blocked');
            },
            removeItem() {
                throw new Error('blocked');
            },
            setItem() {
                throw new Error('blocked');
            },
        };
        assert.equal(
            readGardenStructureEditorRecoveryStorage(unavailable, 'draft'),
            null,
        );
        assert.equal(
            writeGardenStructureEditorRecoveryStorage(
                unavailable,
                'draft',
                'value',
            ),
            false,
        );
    });

    test('keeps one bounded demolition recovery pointer per garden', () => {
        const values = new Map<string, string>();
        const storage = {
            getItem(key: string) {
                return values.get(key) ?? null;
            },
            removeItem(key: string) {
                values.delete(key);
            },
            setItem(key: string, value: string) {
                values.set(key, value);
            },
        };

        assert.equal(
            writeGardenStructureEditorDemolitionRecoveryPointer(
                storage,
                42,
                'structure-1',
            ),
            true,
        );
        assert.equal(
            readGardenStructureEditorDemolitionRecoveryPointer(storage, 42),
            'structure-1',
        );
        assert.equal(
            writeGardenStructureEditorDemolitionRecoveryPointer(
                storage,
                42,
                null,
            ),
            true,
        );
        assert.equal(
            readGardenStructureEditorDemolitionRecoveryPointer(storage, 42),
            null,
        );

        values.set(
            'gredice:garden-structure-editor:v1:garden:42:demolition',
            ' '.repeat(200),
        );
        assert.equal(
            readGardenStructureEditorDemolitionRecoveryPointer(storage, 42),
            null,
        );
        assert.equal(values.size, 0);
    });
});
