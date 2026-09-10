import assert from 'node:assert/strict';
import test from 'node:test';
import type { Block } from '../types/Block';
import {
    readGameProfileAnimalCommand,
    readGameProfileCameraRestoreCommand,
    readGameProfileCloseupCommand,
    readGameProfileOperationVisualHighlightRequest,
    readGameProfileOutlineCommand,
    readGameProfilePlacementCommand,
    resolveGameProfileOperationVisualHighlight,
    resolveGameProfilePlacementBlockIds,
    resolveGameProfileRaisedBedTarget,
} from './GameProfileController';

const firstBlock: Block = {
    id: 'profile-raised-bed:29:0',
    name: 'Raised_Bed',
    rotation: 0,
};

test('profile closeup command validates the deterministic raised bed id', () => {
    assert.deepEqual(
        readGameProfileCloseupCommand({ action: 'open', raisedBedId: 1 }),
        { action: 'open', raisedBedId: 1 },
    );
    assert.deepEqual(readGameProfileCloseupCommand({ action: 'close' }), {
        action: 'close',
    });
    assert.deepEqual(readGameProfileCloseupCommand({ action: 'reset' }), {
        action: 'reset',
    });
    assert.equal(
        readGameProfileCloseupCommand({ action: 'open', raisedBedId: 0 }),
        null,
    );
    assert.equal(
        readGameProfileCloseupCommand({ action: 'open', raisedBedId: '1' }),
        null,
    );
});

test('profile animal command accepts only the deterministic Cow trot request', () => {
    assert.deepEqual(
        readGameProfileAnimalCommand({
            behavior: 'trot',
            species: 'Cow',
        }),
        { behavior: 'trot', species: 'Cow' },
    );
    assert.deepEqual(
        readGameProfileAnimalCommand({
            behavior: 'trot',
            species: 'Cow',
            targetId: null,
        }),
        { behavior: 'trot', species: 'Cow', targetId: null },
    );
    assert.equal(
        readGameProfileAnimalCommand({ behavior: 'idle', species: 'Cow' }),
        null,
    );
    assert.equal(
        readGameProfileAnimalCommand({ behavior: 'trot', species: 'Horse' }),
        null,
    );
    assert.equal(
        readGameProfileAnimalCommand({
            behavior: 'trot',
            species: 'Cow',
            targetId: 'cow-a',
        }),
        null,
    );
});

test('profile camera restore command accepts only a finite positive snapshot', () => {
    const snapshot = {
        position: [-10, 10, -10],
        target: [0, 0, 0],
        zoom: 100,
    };
    assert.deepEqual(readGameProfileCameraRestoreCommand(snapshot), snapshot);

    for (const invalid of [
        null,
        { ...snapshot, position: [0, 0] },
        { ...snapshot, position: [0, 0, Number.NaN] },
        { ...snapshot, target: [0, Number.POSITIVE_INFINITY, 0] },
        { ...snapshot, zoom: 0 },
        { ...snapshot, zoom: Number.NaN },
    ]) {
        assert.equal(readGameProfileCameraRestoreCommand(invalid), null);
    }
});

test('profile target resolution uses the raised bed primary block', () => {
    const target = resolveGameProfileRaisedBedTarget(
        {
            raisedBeds: [
                {
                    blockId: firstBlock.id,
                    id: 29,
                    name: '  Profile raised bed 29  ',
                },
            ],
            stacks: [{ blocks: [firstBlock] }],
        },
        29,
    );

    assert.deepEqual(target, {
        block: firstBlock,
        blockId: firstBlock.id,
        raisedBedName: 'Profile raised bed 29',
        raisedBedId: 29,
    });
    assert.equal(
        resolveGameProfileRaisedBedTarget(
            {
                raisedBeds: [
                    {
                        blockId: 'missing',
                        id: 2,
                        name: 'Missing profile bed',
                    },
                ],
                stacks: [{ blocks: [firstBlock] }],
            },
            2,
        ),
        null,
    );
    assert.equal(
        resolveGameProfileRaisedBedTarget(
            {
                raisedBeds: [
                    {
                        blockId: firstBlock.id,
                        id: 3,
                        name: '   ',
                    },
                ],
                stacks: [{ blocks: [firstBlock] }],
            },
            3,
        ),
        null,
    );
});

test('profile operation visual highlight request requires the exact opt-in and target', () => {
    assert.deepEqual(
        readGameProfileOperationVisualHighlightRequest({
            enabled: '1',
            fieldId: '201',
            positionIndex: '0',
            raisedBedId: '2',
        }),
        {
            fieldId: 201,
            positionIndex: 0,
            raisedBedId: 2,
        },
    );
    assert.equal(
        readGameProfileOperationVisualHighlightRequest({
            enabled: '0',
            fieldId: '201',
            positionIndex: '0',
            raisedBedId: '2',
        }),
        null,
    );
    assert.equal(
        readGameProfileOperationVisualHighlightRequest({
            enabled: '1',
            fieldId: '201-extra',
            positionIndex: '0',
            raisedBedId: '2',
        }),
        null,
    );
    assert.equal(
        readGameProfileOperationVisualHighlightRequest({
            enabled: '1',
            fieldId: '201',
            positionIndex: '-1',
            raisedBedId: '2',
        }),
        null,
    );
});

test('profile operation visual highlight resolves one exact active field after garden readiness', () => {
    const request = {
        fieldId: 201,
        positionIndex: 0,
        raisedBedId: 2,
    };
    const garden = {
        id: 99996,
        raisedBeds: [
            {
                fields: [
                    {
                        active: true,
                        id: 201,
                        positionIndex: 0,
                    },
                    {
                        active: true,
                        id: 202,
                        positionIndex: 1,
                    },
                ],
                id: 2,
                name: '  Profile raised bed 2  ',
            },
        ],
        stacks: [],
    };

    assert.deepEqual(
        resolveGameProfileOperationVisualHighlight(garden, request),
        {
            fieldId: 201,
            gardenId: 99996,
            label: 'Polje 1',
            message: 'Profil operacijskih vizuala',
            positionIndex: 0,
            raisedBedId: 2,
            raisedBedName: 'Profile raised bed 2',
        },
    );
    assert.equal(
        resolveGameProfileOperationVisualHighlight(garden, {
            ...request,
            positionIndex: 1,
        }),
        null,
    );
    assert.equal(
        resolveGameProfileOperationVisualHighlight(
            {
                ...garden,
                raisedBeds: [
                    {
                        ...garden.raisedBeds[0],
                        fields: [
                            {
                                active: false,
                                id: 201,
                                positionIndex: 0,
                            },
                        ],
                    },
                ],
            },
            request,
        ),
        null,
    );
    assert.equal(
        resolveGameProfileOperationVisualHighlight(null, request),
        null,
    );
});

test('profile outline command validates the deterministic raised bed id', () => {
    assert.deepEqual(
        readGameProfileOutlineCommand({ action: 'show', raisedBedId: 2 }),
        {
            action: 'show',
            raisedBedId: 2,
        },
    );
    assert.deepEqual(readGameProfileOutlineCommand({ action: 'hide' }), {
        action: 'hide',
    });
    assert.equal(
        readGameProfileOutlineCommand({ action: 'show', raisedBedId: 0 }),
        null,
    );
    assert.equal(
        readGameProfileOutlineCommand({ action: 'show', raisedBedId: '2' }),
        null,
    );
    assert.equal(readGameProfileOutlineCommand({ action: 'reset' }), null);
});

test('profile placement command validates the repeatable stagger', () => {
    assert.deepEqual(readGameProfilePlacementCommand({ action: 'run' }), {
        action: 'run',
        staggerMs: 120,
    });
    assert.deepEqual(
        readGameProfilePlacementCommand({ action: 'run', staggerMs: 80 }),
        {
            action: 'run',
            staggerMs: 80,
        },
    );
    assert.deepEqual(readGameProfilePlacementCommand({ action: 'reset' }), {
        action: 'reset',
    });
    assert.equal(
        readGameProfilePlacementCommand({ action: 'run', staggerMs: -1 }),
        null,
    );
});

test('profile placement targets use one entity batch across separate chunks', () => {
    const blockA: Block = {
        id: 'grass-a',
        name: 'Block_Grass',
        rotation: 0,
    };
    const blockB: Block = {
        id: 'grass-b',
        name: 'Block_Grass',
        rotation: 0,
    };

    assert.deepEqual(
        resolveGameProfilePlacementBlockIds({
            raisedBeds: [],
            stacks: [
                {
                    blocks: [blockA],
                    position: { x: 0, z: 0 },
                },
                {
                    blocks: [
                        {
                            id: 'non-instanced',
                            name: 'Unknown',
                            rotation: 0,
                        },
                    ],
                    position: { x: 8, z: 0 },
                },
                {
                    blocks: [blockB],
                    position: { x: 9, z: 0 },
                },
            ],
        }),
        ['grass-a', 'grass-b'],
    );
});
