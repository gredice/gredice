import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Vector3 } from 'three';
import { getGameTimeOfDay } from '../utils/timeOfDay';
import { getPublicGardenRaisedBedInteractionTargets } from './PublicGardenRaisedBedInteractions';
import {
    getPublicGardenCaptureInitialView,
    getPublicGardenCapturePhaseDate,
    getPublicGardenInitialView,
    getPublicGardenRaisedBedsWithBlocks,
    getPublicGardenStacksCenter,
    getPublicGardenStructureInitialViewKey,
    isPublicGardenStructureCaptureReady,
    normalizePublicGardenStacks,
    type PublicGardenCapturePhase,
    type PublicGardenStack,
    resolvePublicGardenSceneFrameloop,
    resolvePublicGardenSceneInitialView,
    shouldRenderPublicGardenGroundDecorations,
} from './PublicGardenViewer';

describe('resolvePublicGardenSceneFrameloop', () => {
    it('isolates capture roots while ordinary scenes remain demand-rendered', () => {
        assert.equal(resolvePublicGardenSceneFrameloop(false), 'demand');
        assert.equal(resolvePublicGardenSceneFrameloop(true), 'never');
    });
});

describe('shouldRenderPublicGardenGroundDecorations', () => {
    it('keeps the normal detail default while allowing an isolated foliage override', () => {
        assert.equal(
            shouldRenderPublicGardenGroundDecorations(true, undefined),
            true,
        );
        assert.equal(
            shouldRenderPublicGardenGroundDecorations(false, undefined),
            false,
        );
        assert.equal(
            shouldRenderPublicGardenGroundDecorations(false, true),
            true,
        );
        assert.equal(
            shouldRenderPublicGardenGroundDecorations(true, false),
            false,
        );
    });
});

describe('getPublicGardenCapturePhaseDate', () => {
    it('resolves stable renderer times for every wallpaper phase', () => {
        const location = { lat: 45.739, lon: 16.572 };
        const phases: Array<readonly [PublicGardenCapturePhase, number]> = [
            ['morning', 0.22],
            ['day', 0.5],
            ['evening', 0.79],
            ['night', 0.94],
        ];

        for (const [phase, expectedTimeOfDay] of phases) {
            const date = getPublicGardenCapturePhaseDate(phase, location);
            const actualTimeOfDay = getGameTimeOfDay(location, date);

            assert.ok(Math.abs(actualTimeOfDay - expectedTimeOfDay) < 0.002);
        }
    });
});

describe('getPublicGardenRaisedBedsWithBlocks', () => {
    it('excludes raised beds that cannot be selected in the rendered garden', () => {
        const stacks = normalizePublicGardenStacks([
            {
                x: 2,
                y: 5,
                blocks: [
                    {
                        id: 'raised-bed-1',
                        name: 'Raised_Bed',
                        rotation: 0,
                    },
                ],
            },
        ]);

        const raisedBeds = getPublicGardenRaisedBedsWithBlocks(
            [
                { id: 1, blockId: 'raised-bed-1' },
                { id: 2, blockId: 'removed-raised-bed' },
                { id: 3, blockId: null },
            ],
            stacks,
        );

        assert.deepEqual(
            raisedBeds.map((raisedBed) => raisedBed.id),
            [1],
        );
    });
});

describe('normalizePublicGardenStacks', () => {
    it('preserves a Rabbit coat variant in public device-facing data', () => {
        const [stack] = normalizePublicGardenStacks([
            {
                x: 2,
                y: 3,
                blocks: [
                    {
                        id: 'rabbit-public',
                        name: 'Rabbit',
                        rotation: 0,
                        variant: 1,
                    },
                ],
            },
        ]);

        assert.equal(stack?.blocks[0]?.variant, 1);
    });

    it('maps public garden rows onto the game z axis', () => {
        const publicStacks: PublicGardenStack[] = [
            {
                x: 2,
                y: 5,
                blocks: [
                    {
                        id: 'block-1',
                        name: 'Block_Grass',
                        rotation: 0,
                    },
                ],
            },
        ];

        const [stack] = normalizePublicGardenStacks(publicStacks);

        assert.ok(stack);
        assert.equal(stack.position.x, 2);
        assert.equal(stack.position.y, 0);
        assert.equal(stack.position.z, 5);
    });
});

describe('getPublicGardenStacksCenter', () => {
    it('centers the camera target across public garden x and z bounds', () => {
        const stacks = normalizePublicGardenStacks([
            { x: 0, y: 4, blocks: [] },
            { x: 6, y: 10, blocks: [] },
        ]);

        const center = getPublicGardenStacksCenter(stacks);

        assert.equal(center.x, 3);
        assert.equal(center.y, 0);
        assert.equal(center.z, 7);
    });
});

describe('getPublicGardenInitialView', () => {
    it('uses the saved public garden home camera when available', () => {
        const view = getPublicGardenInitialView({
            homeCamera: {
                position: [12, 80, -18],
                target: [4, 0, -6],
                zoom: 140,
            },
            stacks: normalizePublicGardenStacks([
                { x: 0, y: 4, blocks: [] },
                { x: 6, y: 10, blocks: [] },
            ]),
        });

        assert.equal(view.cameraPosition.x, 12);
        assert.equal(view.cameraPosition.y, 80);
        assert.equal(view.cameraPosition.z, -18);
        assert.equal(view.cameraTarget.x, 4);
        assert.equal(view.cameraTarget.y, 0);
        assert.equal(view.cameraTarget.z, -6);
        assert.equal(view.cameraZoom, 140);
    });

    it('falls back to centering the garden bounds', () => {
        const view = getPublicGardenInitialView({
            stacks: normalizePublicGardenStacks([
                { x: 0, y: 4, blocks: [] },
                { x: 6, y: 10, blocks: [] },
            ]),
        });

        assert.equal(view.cameraPosition.x, -97);
        assert.equal(view.cameraPosition.y, 100);
        assert.equal(view.cameraPosition.z, -93);
        assert.equal(view.cameraTarget.x, 3);
        assert.equal(view.cameraTarget.y, 0);
        assert.equal(view.cameraTarget.z, 7);
        assert.equal(view.cameraZoom, 90);
    });

    it('centers a structure-only public scene for normal and preview rendering', () => {
        const structureBounds = {
            depth: 10,
            height: 3,
            maxHeight: 3,
            maxX: 30,
            maxY: 5,
            minHeight: 0,
            minX: 20,
            minY: -5,
            width: 10,
        };

        const view = getPublicGardenInitialView({
            stacks: [],
            structureBounds,
        });
        const capture = getPublicGardenCaptureInitialView({
            stacks: [],
            structureBounds,
            viewport: { height: 844, width: 390 },
        });

        assert.deepEqual(view.cameraTarget.toArray(), [25, 0, 0]);
        assert.deepEqual(capture.cameraTarget.toArray(), [25, 0, 0]);
        assert.ok(capture.cameraZoom >= 24);
        assert.ok(capture.cameraZoom < 90);
    });
});

describe('resolvePublicGardenSceneInitialView', () => {
    it('preserves an explicit or saved-home view instead of structure framing', () => {
        const initialView = {
            cameraPosition: new Vector3(12, 80, -18),
            cameraTarget: new Vector3(4, 0, -6),
            cameraZoom: 140,
        };

        const resolved = resolvePublicGardenSceneInitialView({
            captureFitGarden: false,
            initialView,
            resolveStructureFraming: false,
            stacks: [],
            structureBounds: {
                depth: 10,
                maxX: 30,
                maxY: 5,
                minX: 20,
                minY: -5,
                width: 10,
            },
        });

        assert.equal(resolved, initialView);
    });

    it('fits a capture from the validated compiled structure bounds', () => {
        const resolved = resolvePublicGardenSceneInitialView({
            captureFitGarden: true,
            captureViewport: { height: 844, width: 390 },
            initialView: {
                cameraPosition: new Vector3(-100, 100, -100),
                cameraTarget: new Vector3(0, 0, 0),
                cameraZoom: 90,
            },
            resolveStructureFraming: true,
            stacks: [],
            structureBounds: {
                depth: 10,
                maxX: 30,
                maxY: 5,
                minX: 20,
                minY: -5,
                width: 10,
            },
        });

        assert.deepEqual(resolved.cameraTarget.toArray(), [25, 0, 0]);
        assert.ok(resolved.cameraZoom >= 24);
        assert.ok(resolved.cameraZoom < 90);
    });
});

describe('getPublicGardenStructureInitialViewKey', () => {
    const bounds = {
        depth: 2,
        maxX: 4,
        maxY: 3,
        minX: 2,
        minY: 1,
        width: 2,
    };

    it('changes for validated footprint movement but not revision-only or furniture edits', () => {
        const original = [
            {
                footprint: { bounds },
                furnitureIds: ['table-1'],
                revision: 1,
                structureId: 'house-1',
            },
        ];
        const revisionAndFurnitureOnly = [
            {
                footprint: { bounds },
                furnitureIds: ['table-2'],
                revision: 2,
                structureId: 'house-1',
            },
        ];
        const moved = [
            {
                footprint: {
                    bounds: {
                        ...bounds,
                        maxX: 9,
                        minX: 7,
                    },
                },
                furnitureIds: ['table-2'],
                revision: 3,
                structureId: 'house-1',
            },
        ];

        const originalKey = getPublicGardenStructureInitialViewKey({
            gardenId: 7,
            structures: original,
        });

        assert.equal(
            getPublicGardenStructureInitialViewKey({
                gardenId: 7,
                structures: revisionAndFurnitureOnly,
            }),
            originalKey,
        );
        assert.notEqual(
            getPublicGardenStructureInitialViewKey({
                gardenId: 7,
                structures: moved,
            }),
            originalKey,
        );
    });
});

describe('isPublicGardenStructureCaptureReady', () => {
    it('allows gardens without structures and fully ready compiled plans', () => {
        assert.equal(
            isPublicGardenStructureCaptureReady({
                diagnosticStatus: 'ready',
                hasPlan: false,
                rejectedRecordCount: 0,
                rendererReady: false,
                savedStructureCount: 0,
            }),
            true,
        );
        assert.equal(
            isPublicGardenStructureCaptureReady({
                diagnosticStatus: 'ready',
                hasPlan: true,
                rejectedRecordCount: 0,
                rendererReady: true,
                savedStructureCount: 1,
            }),
            true,
        );
        assert.equal(
            isPublicGardenStructureCaptureReady({
                diagnosticStatus: 'ready',
                hasPlan: true,
                rejectedRecordCount: 0,
                rendererReady: false,
                savedStructureCount: 1,
            }),
            false,
        );
    });

    it('allows warning-only plans while blocking rejected saved structures', () => {
        assert.equal(
            isPublicGardenStructureCaptureReady({
                diagnosticStatus: 'rendered-with-diagnostics',
                hasPlan: true,
                rejectedRecordCount: 0,
                rendererReady: true,
                savedStructureCount: 1,
            }),
            true,
        );

        for (const diagnosticStatus of [
            'collection-rejected',
            'collision-rejected',
        ] as const) {
            assert.equal(
                isPublicGardenStructureCaptureReady({
                    diagnosticStatus,
                    hasPlan: false,
                    rejectedRecordCount: 1,
                    rendererReady: false,
                    savedStructureCount: 1,
                }),
                false,
            );
        }
        assert.equal(
            isPublicGardenStructureCaptureReady({
                diagnosticStatus: 'rendered-with-diagnostics',
                hasPlan: true,
                rejectedRecordCount: 1,
                rendererReady: true,
                savedStructureCount: 1,
            }),
            false,
        );
        assert.equal(
            isPublicGardenStructureCaptureReady({
                diagnosticStatus: 'ready',
                hasPlan: false,
                rejectedRecordCount: 0,
                rendererReady: false,
                savedStructureCount: 1,
            }),
            false,
        );
    });
});

describe('getPublicGardenCaptureInitialView', () => {
    it('fits compact and elongated gardens inside an ultrawide capture', () => {
        const compact = getPublicGardenCaptureInitialView({
            stacks: normalizePublicGardenStacks([{ x: 0, y: 0, blocks: [] }]),
            viewport: { height: 1440, width: 3440 },
        });
        const elongated = getPublicGardenCaptureInitialView({
            stacks: normalizePublicGardenStacks(
                Array.from({ length: 24 }, (_, index) => ({
                    x: index,
                    y: 0,
                    blocks: [],
                })),
            ),
            viewport: { height: 1440, width: 3440 },
        });

        assert.ok(compact.cameraZoom > 150);
        assert.ok(compact.cameraZoom <= 180);
        assert.ok(elongated.cameraZoom < compact.cameraZoom);
        assert.ok(elongated.cameraZoom >= 24);
    });

    it('supports a lower outlet-only floor for a large phone viewport scene', () => {
        const view = getPublicGardenCaptureInitialView({
            minimumZoom: 18,
            stacks: normalizePublicGardenStacks(
                Array.from({ length: 50 }, (_, index) => ({
                    x: index,
                    y: 0,
                    blocks: [],
                })),
            ),
            viewport: { height: 456, width: 390 },
        });

        assert.equal(view.cameraZoom, 18);
    });
});

describe('getPublicGardenRaisedBedInteractionTargets', () => {
    it('registers only raised-bed blocks for public selection', () => {
        const stacks = normalizePublicGardenStacks([
            {
                x: 2,
                y: 5,
                blocks: [
                    {
                        id: 'raised-bed-1',
                        name: 'Raised_Bed',
                        rotation: 0,
                    },
                    {
                        id: 'decoration-1',
                        name: 'Bucket',
                        rotation: 0,
                    },
                ],
            },
        ]);

        const targets = getPublicGardenRaisedBedInteractionTargets(stacks);

        assert.equal(targets.length, 1);
        assert.equal(targets[0]?.block.id, 'raised-bed-1');
        assert.equal(targets[0]?.blockIndex, 0);
    });
});
