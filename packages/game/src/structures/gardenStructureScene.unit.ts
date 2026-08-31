import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    createGardenStructureTemplateSeed,
    getGardenStructureWorldFootprintCells,
} from '@gredice/js/gardenStructures';
import { Vector3 } from 'three';
import { getLocalSandboxBlockData } from '../localSandboxBlockData';
import {
    createGardenStructureSceneBaseHeightResolver,
    createGardenStructureSceneBuildPreviewCompileInput,
    createGardenStructureSceneFixtureBuildPreviewCompileInput,
    type GardenStructureCollectionCacheDisposalReason,
    type GardenStructureSceneBuildPreviewInput,
    GardenStructureSceneCache,
    resolveGardenStructureSceneStructureBaseHeight,
} from './index';

function savedStructure({
    anchorX = 0,
    anchorY = 0,
    id = 'structure-one',
    revision = 1,
}: {
    anchorX?: number;
    anchorY?: number;
    id?: string;
    revision?: number;
} = {}) {
    const seed = createGardenStructureTemplateSeed('house');
    return {
        anchorX,
        anchorY,
        document: seed.document,
        id,
        isDeleted: false,
        kitKey: seed.kitKey,
        kitVersion: seed.kitVersion,
        revision,
        rotation: 0,
        templateKey: seed.templateKey,
    };
}

describe('GardenStructureSceneCache', () => {
    it('does no collection work for a garden without saved structures', () => {
        const cache = new GardenStructureSceneCache();

        const snapshot = cache.resolve({ gardenId: 1, records: [] });

        assert.equal(snapshot.plan, null);
        assert.equal(snapshot.collisionWorld, undefined);
        assert.equal(snapshot.diagnostics.status, 'ready');
        assert.equal(cache.snapshot(), null);
    });

    it('does not inspect block or stack inputs for a garden without structures', () => {
        const unreadable = new Proxy([], {
            get() {
                throw new Error('empty structure resolution read scene data');
            },
        });

        const resolveBaseHeight = createGardenStructureSceneBaseHeightResolver({
            blockData: unreadable,
            records: [],
            stacks: unreadable,
        });

        assert.equal(Number.isNaN(resolveBaseHeight('missing')), true);
    });

    it('reuses structure compilation and drops the superseded collection on revision update', () => {
        const disposalReasons: GardenStructureCollectionCacheDisposalReason[] =
            [];
        const cache = new GardenStructureSceneCache({
            collectionCache: {
                dispose: (_plan, reason) => disposalReasons.push(reason),
            },
        });

        const first = cache.resolve({
            gardenId: 1,
            records: [savedStructure()],
        });
        const repeated = cache.resolve({
            gardenId: 1,
            records: [savedStructure()],
        });
        const revised = cache.resolve({
            gardenId: 1,
            records: [savedStructure({ revision: 2 })],
        });

        assert.equal(repeated.plan, first.plan);
        assert.notEqual(revised.plan, first.plan);
        assert.equal(revised.plan?.structures[0]?.revision, 2);
        assert.deepEqual(disposalReasons, ['deleted']);
        assert.equal(cache.snapshot()?.entryCount, 1);
        assert.equal(cache.snapshot()?.structurePlanCache.hitCount, 1);
    });

    it('clears garden-owned plans when the viewer switches gardens and on disposal', () => {
        const disposals: Array<{
            reason: GardenStructureCollectionCacheDisposalReason;
            structureId: string | undefined;
        }> = [];
        const cache = new GardenStructureSceneCache({
            collectionCache: {
                dispose: (plan, reason) =>
                    disposals.push({
                        reason,
                        structureId: plan.structures[0]?.structureId,
                    }),
            },
        });

        cache.resolve({
            gardenId: 1,
            records: [savedStructure({ id: 'first-garden' })],
        });
        const secondGarden = cache.resolve({
            gardenId: 2,
            records: [savedStructure({ id: 'second-garden' })],
        });

        assert.deepEqual(disposals, [
            { reason: 'cleared', structureId: 'first-garden' },
        ]);
        assert.equal(
            secondGarden.plan?.structures[0]?.structureId,
            'second-garden',
        );

        cache.dispose();

        assert.deepEqual(disposals, [
            { reason: 'cleared', structureId: 'first-garden' },
            { reason: 'cleared', structureId: 'second-garden' },
        ]);
        assert.equal(cache.snapshot(), null);
    });

    it('releases collection and semantic plan caches when the last structure disappears', () => {
        const cache = new GardenStructureSceneCache();

        cache.resolve({ gardenId: 1, records: [savedStructure()] });
        assert.equal(cache.snapshot()?.entryCount, 1);
        assert.equal(cache.snapshot()?.structurePlanCache.entryCount, 1);

        const empty = cache.resolve({ gardenId: 1, records: [] });

        assert.equal(empty.plan, null);
        assert.equal(cache.snapshot(), null);
    });

    it('deduplicates diagnostic codes without falsely reporting truncation', () => {
        const cache = new GardenStructureSceneCache();
        const invalidRecords = Array.from({ length: 12 }, (_, index) => ({
            ...savedStructure({ id: `invalid-${index.toString()}` }),
            revision: 0,
        }));

        const snapshot = cache.resolve({
            gardenId: 1,
            records: [savedStructure(), ...invalidRecords],
        });

        assert.equal(snapshot.plan?.structures.length, 1);
        assert.equal(snapshot.diagnostics.status, 'rendered-with-diagnostics');
        assert.equal(snapshot.diagnostics.rejectedRecordCount, 12);
        assert.deepEqual(snapshot.diagnostics.sampledIssueCodes, [
            'invalid-revision',
        ]);
        assert.equal(snapshot.diagnostics.issueSampleTruncated, false);
    });

    it('builds one optional coarse collision world from the rendered collection', () => {
        const cache = new GardenStructureSceneCache();
        const records = [
            savedStructure({ id: 'owned-house' }),
            savedStructure({ anchorX: 8, id: 'public-house' }),
        ];

        const renderOnly = cache.resolve({
            gardenId: 1,
            includeCollision: false,
            records,
        });
        const interactive = cache.resolve({
            gardenId: 1,
            includeCollision: true,
            records,
        });

        assert.equal(renderOnly.collisionWorld, undefined);
        assert.equal(interactive.plan, renderOnly.plan);
        assert.ok(interactive.collisionWorld);
        assert.ok(interactive.collisionWorld.surfaces.length > 0);
        assert.ok(
            (interactive.collisionWorld.spatialIndex?.surfacesByBucket.size ??
                0) > 0,
        );
    });

    it('fails closed instead of rendering passable structures when collision compilation fails', () => {
        const cache = new GardenStructureSceneCache({
            createCollisionWorld: () => {
                throw new Error('collision unavailable');
            },
        });

        const snapshot = cache.resolve({
            gardenId: 1,
            includeCollision: true,
            records: [savedStructure()],
        });

        assert.equal(snapshot.plan, null);
        assert.equal(snapshot.collisionWorld, undefined);
        assert.equal(snapshot.diagnostics.status, 'collision-rejected');
        assert.deepEqual(snapshot.diagnostics.sampledIssueCodes, [
            'collision-rejected',
        ]);
        assert.equal(snapshot.diagnostics.issueSampleTruncated, false);
    });

    it('marks a full diagnostic sample truncated after collision rejection', () => {
        const validRecord = savedStructure();
        const records = [
            validRecord,
            null,
            { ...validRecord, id: '' },
            { ...validRecord, anchorX: 0.5, id: 'invalid-placement' },
            { ...validRecord, id: 'invalid-revision', revision: 0 },
            {
                ...validRecord,
                deleted: true,
                id: 'ambiguous-delete-state',
                isDeleted: false,
            },
            {
                ...validRecord,
                id: 'kit-unavailable',
                kitVersion: 'missing',
            },
            {
                ...validRecord,
                document: { ...validRecord.document, schemaVersion: 2 },
                id: 'unsupported-schema-version',
            },
        ];
        const cache = new GardenStructureSceneCache({
            createCollisionWorld: () => {
                throw new Error('collision unavailable');
            },
        });

        const renderOnly = cache.resolve({
            gardenId: 1,
            includeCollision: false,
            records,
        });
        const interactive = cache.resolve({
            gardenId: 1,
            includeCollision: true,
            records,
        });

        assert.equal(renderOnly.diagnostics.sampledIssueCodes.length, 8);
        assert.equal(renderOnly.diagnostics.issueSampleTruncated, false);
        assert.equal(interactive.diagnostics.sampledIssueCodes.length, 8);
        assert.ok(
            interactive.diagnostics.sampledIssueCodes.includes(
                'collision-rejected',
            ),
        );
        assert.equal(interactive.diagnostics.issueSampleTruncated, true);
    });

    it('grounds visual and collision plans on the validated flat block support', () => {
        const record = savedStructure();
        const stacks = getGardenStructureWorldFootprintCells(record.document, {
            anchorX: record.anchorX,
            anchorY: record.anchorY,
            rotation: 0,
        }).map((cell, index) => ({
            blocks: [
                {
                    id: `ground-${index.toString()}`,
                    name: 'Block_Grass',
                    rotation: 0,
                },
            ],
            position: new Vector3(cell.x, 0, cell.y),
        }));
        const resolveBaseHeight = createGardenStructureSceneBaseHeightResolver({
            blockData: getLocalSandboxBlockData(),
            records: [record],
            stacks,
        });
        const cache = new GardenStructureSceneCache();

        const snapshot = cache.resolve({
            gardenId: 1,
            records: [record],
            resolveBaseHeight,
        });

        assert.equal(snapshot.plan?.structures[0]?.baseHeight, 0.4);
        assert.ok(
            snapshot.collisionWorld?.surfaces.some(
                (surface) => surface.y === 0.4 && surface.roamable,
            ),
        );
    });

    it('resolves an editor preview to the same ordinary-block support height', () => {
        const record = savedStructure();
        const stacks = getGardenStructureWorldFootprintCells(record.document, {
            anchorX: record.anchorX,
            anchorY: record.anchorY,
            rotation: 0,
        }).map((cell, index) => ({
            blocks: [
                {
                    id: `preview-ground-${index.toString()}`,
                    name: 'Block_Grass',
                    rotation: 0,
                },
            ],
            position: new Vector3(cell.x, 0, cell.y),
        }));

        const baseHeight = resolveGardenStructureSceneStructureBaseHeight({
            blockData: getLocalSandboxBlockData(),
            document: record.document,
            placement: {
                anchorX: record.anchorX,
                anchorY: record.anchorY,
                rotation: 0,
            },
            stacks,
        });
        const previewInput = createGardenStructureSceneBuildPreviewCompileInput(
            {
                blockData: getLocalSandboxBlockData(),
                document: record.document,
                placement: {
                    anchorX: record.anchorX,
                    anchorY: record.anchorY,
                    rotation: 0,
                },
                revision: record.revision,
                stacks,
                structureId: record.id,
            },
        );

        assert.equal(baseHeight, 0.4);
        assert.equal(previewInput?.baseHeight, 0.4);
    });

    it('limits unsupported preview fallback to the isolated fixture helper', () => {
        const record = savedStructure();
        const stacks = [
            {
                blocks: [
                    {
                        id: 'fixture-ground',
                        name: 'Block_Grass',
                        rotation: 0,
                    },
                ],
                position: new Vector3(record.anchorX, 0, record.anchorY),
            },
        ];
        const input = {
            blockData: getLocalSandboxBlockData(),
            document: record.document,
            placement: {
                anchorX: record.anchorX,
                anchorY: record.anchorY,
                rotation: 0,
            },
            revision: record.revision,
            stacks,
            structureId: record.id,
        } satisfies GardenStructureSceneBuildPreviewInput;

        assert.equal(
            createGardenStructureSceneBuildPreviewCompileInput(input),
            null,
        );
        assert.equal(
            createGardenStructureSceneFixtureBuildPreviewCompileInput(input)
                ?.baseHeight,
            0.4,
        );
    });

    it('excludes unsupported saved structures from render and framing bounds', () => {
        const record = savedStructure({ anchorX: 90 });
        const resolveBaseHeight = createGardenStructureSceneBaseHeightResolver({
            blockData: getLocalSandboxBlockData(),
            records: [record],
            stacks: [],
        });
        const cache = new GardenStructureSceneCache();

        const snapshot = cache.resolve({
            gardenId: 1,
            records: [record],
            resolveBaseHeight,
        });

        assert.equal(snapshot.plan?.structures.length, 0);
        assert.equal(snapshot.plan?.worldBounds, null);
        assert.equal(snapshot.collisionWorld, undefined);
        assert.equal(snapshot.diagnostics.status, 'rendered-with-diagnostics');
        assert.equal(snapshot.diagnostics.rejectedRecordCount, 1);
    });
});
