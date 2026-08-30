import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { BlockData } from '@gredice/directory-types';
import type {
    ValidateRotatedBlockPlacementInput,
    ValidateRotatedBlockPlacementResult,
} from './gardenBlockMutationService';
import { validateRotatedBlockPlacement } from './rotatedBlockPlacementValidation';

type SnapshotBlock =
    ValidateRotatedBlockPlacementInput['snapshot']['blocks'][number];
type SnapshotStack =
    ValidateRotatedBlockPlacementInput['snapshot']['stacks'][number];

function directoryBlock(
    id: number,
    name: string,
    overrides: Readonly<{
        height?: number;
        placeableOnWater?: boolean;
        spanDepth?: number;
        spanWidth?: number;
        stackable?: boolean;
    }> = {},
): BlockData {
    return {
        id,
        entityType: { id: 8, label: 'Blok', name: 'block' },
        slug: name.toLowerCase(),
        information: {
            fullDescription: '',
            label: name,
            name,
            shortDescription: '',
        },
        attributes: {
            height: overrides.height ?? 1,
            nightOnlyPurchase: false,
            ...(overrides.placeableOnWater === undefined
                ? {}
                : { placeableOnWater: overrides.placeableOnWater }),
            ...(overrides.spanDepth === undefined
                ? {}
                : { spanDepth: overrides.spanDepth }),
            ...(overrides.spanWidth === undefined
                ? {}
                : { spanWidth: overrides.spanWidth }),
            stackable: overrides.stackable ?? true,
            type: 'decoration',
        },
        prices: { sunflowers: 50 },
        functions: { raisedBed: false, recycler: false },
        createdAt: '2026-08-30T00:00:00.000Z',
        updatedAt: '2026-08-30T00:00:00.000Z',
    };
}

function block(
    id: string,
    name: string,
    rotation: number | null = 0,
): SnapshotBlock {
    return {
        id,
        message: null,
        name,
        rotation,
        variant: null,
    };
}

function stack(
    positionX: number,
    positionY: number,
    blocks: string[],
): SnapshotStack {
    return { blocks, positionX, positionY };
}

const groundData = directoryBlock(1, 'Block_Grass');
const canopyData = directoryBlock(2, 'Canopy', {
    spanDepth: 2,
    spanWidth: 1,
});

function rotationInput({
    blockData = [groundData, canopyData],
    blocks = [
        block('ground-anchor', 'Block_Grass'),
        block('ground-new-cell', 'Block_Grass'),
        block('ground-old-cell', 'Block_Grass'),
        block('candidate', 'Canopy'),
    ],
    candidateRotation = 1,
    stacks = [
        stack(0, 0, ['ground-anchor', 'candidate']),
        stack(1, 0, ['ground-new-cell']),
        stack(0, 1, ['ground-old-cell']),
    ],
}: Readonly<{
    blockData?: readonly BlockData[];
    blocks?: readonly SnapshotBlock[];
    candidateRotation?: number | null;
    stacks?: readonly SnapshotStack[];
}> = {}): ValidateRotatedBlockPlacementInput {
    const candidate = blocks.find((entry) => entry.id === 'candidate');
    const candidateStack = stacks.find((entry) =>
        entry.blocks.includes('candidate'),
    );
    if (!candidate || !candidateStack) {
        throw new Error('Test fixture requires a placed candidate block');
    }
    const stackIndex = candidateStack.blocks.indexOf('candidate');
    return {
        block: candidate,
        blockData,
        candidateRotation,
        placement: { stack: candidateStack, stackIndex },
        snapshot: {
            blocks,
            garden: {
                accountId: 'account-1',
                id: 42,
                isSandbox: false,
            },
            stacks,
        },
        structures: [],
    };
}

function expectFailure(
    result: ValidateRotatedBlockPlacementResult,
    code: Extract<
        ValidateRotatedBlockPlacementResult,
        { valid: false }
    >['code'] = 'GARDEN_STATE_INVALID',
) {
    assert.equal(result.valid, false);
    if (result.valid) {
        throw new Error(`Expected ${code}, received a valid rotation`);
    }
    assert.equal(result.code, code);
    return result;
}

describe('validateRotatedBlockPlacement', () => {
    test('allows a supported 1x2 footprint to rotate into 2x1', async () => {
        const result = await validateRotatedBlockPlacement(rotationInput());

        assert.deepEqual(result, { valid: true });
    });

    test('rejects horizontal and vertical interval overlap in an occupied cell', async () => {
        const blockerData = directoryBlock(3, 'Long_Blocker', {
            spanDepth: 2,
            spanWidth: 1,
        });
        const result = await validateRotatedBlockPlacement(
            rotationInput({
                blockData: [groundData, canopyData, blockerData],
                blocks: [
                    block('ground-anchor', 'Block_Grass'),
                    block('ground-new-cell', 'Block_Grass'),
                    block('ground-old-cell', 'Block_Grass'),
                    block('candidate', 'Canopy'),
                    block('blocker', 'Long_Blocker'),
                ],
                stacks: [
                    stack(0, 0, ['ground-anchor', 'candidate']),
                    stack(1, 0, ['ground-new-cell', 'blocker']),
                    stack(0, 1, ['ground-old-cell']),
                ],
            }),
        );

        const failure = expectFailure(result);
        assert.match(failure.error, /overlaps another block/i);
    });

    test('rejects a rotated footprint with uneven support', async () => {
        const halfSupportData = directoryBlock(3, 'Half_Support', {
            height: 0.5,
        });
        const result = await validateRotatedBlockPlacement(
            rotationInput({
                blockData: [groundData, canopyData, halfSupportData],
                blocks: [
                    block('ground-anchor', 'Block_Grass'),
                    block('half-support', 'Half_Support'),
                    block('ground-old-cell', 'Block_Grass'),
                    block('candidate', 'Canopy'),
                ],
                stacks: [
                    stack(0, 0, ['ground-anchor', 'candidate']),
                    stack(1, 0, ['half-support']),
                    stack(0, 1, ['ground-old-cell']),
                ],
            }),
        );

        const failure = expectFailure(result);
        assert.match(failure.error, /missing or uneven support/i);
    });

    test('requires water below every rotated fishing-boat cell', async () => {
        const waterData = directoryBlock(2, 'Block_Water');
        const boatData = directoryBlock(3, 'FishingBoat', {
            placeableOnWater: true,
            spanDepth: 2,
            spanWidth: 1,
        });
        const result = await validateRotatedBlockPlacement(
            rotationInput({
                blockData: [groundData, waterData, boatData],
                blocks: [
                    block('water-anchor', 'Block_Water'),
                    block('land-new-cell', 'Block_Grass'),
                    block('water-old-cell', 'Block_Water'),
                    block('candidate', 'FishingBoat'),
                ],
                stacks: [
                    stack(0, 0, ['water-anchor', 'candidate']),
                    stack(1, 0, ['land-new-cell']),
                    stack(0, 1, ['water-old-cell']),
                ],
            }),
        );

        const failure = expectFailure(result);
        assert.match(failure.error, /incompatible support|requires water/i);

        const supported = await validateRotatedBlockPlacement(
            rotationInput({
                blockData: [waterData, boatData],
                blocks: [
                    block('water-anchor', 'Block_Water'),
                    block('water-new-cell', 'Block_Water'),
                    block('water-old-cell', 'Block_Water'),
                    block('candidate', 'FishingBoat'),
                ],
                stacks: [
                    stack(0, 0, ['water-anchor', 'candidate']),
                    stack(1, 0, ['water-new-cell']),
                    stack(0, 1, ['water-old-cell']),
                ],
            }),
        );
        assert.deepEqual(supported, { valid: true });
    });

    test('rejects rotation that removes level support from a block above', async () => {
        const upperData = directoryBlock(3, 'Upper_Canopy', {
            spanDepth: 2,
            spanWidth: 1,
        });
        const result = await validateRotatedBlockPlacement(
            rotationInput({
                blockData: [groundData, canopyData, upperData],
                blocks: [
                    block('ground-anchor', 'Block_Grass'),
                    block('ground-new-cell', 'Block_Grass'),
                    block('ground-old-cell', 'Block_Grass'),
                    block('candidate', 'Canopy'),
                    block('upper', 'Upper_Canopy'),
                ],
                stacks: [
                    stack(0, 0, ['ground-anchor', 'candidate', 'upper']),
                    stack(1, 0, ['ground-new-cell']),
                    stack(0, 1, ['ground-old-cell']),
                ],
            }),
        );

        const failure = expectFailure(result);
        assert.match(failure.error, /missing or uneven support/i);
    });

    test('fails closed on duplicate placement and non-int32 rotation', async () => {
        const duplicatePlacement = await validateRotatedBlockPlacement(
            rotationInput({
                stacks: [
                    stack(0, 0, ['ground-anchor', 'candidate']),
                    stack(1, 0, ['ground-new-cell', 'candidate']),
                    stack(0, 1, ['ground-old-cell']),
                ],
            }),
        );
        expectFailure(duplicatePlacement);

        const invalidRotation = await validateRotatedBlockPlacement(
            rotationInput({ candidateRotation: 1.5 }),
        );
        expectFailure(invalidRotation, 'INVALID_REQUEST');
    });

    test('fails closed on duplicate catalogue names and stack coordinates', async () => {
        const duplicateCatalog = await validateRotatedBlockPlacement(
            rotationInput({
                blockData: [groundData, canopyData, { ...canopyData, id: 99 }],
            }),
        );
        expectFailure(duplicateCatalog, 'BLOCK_DIRECTORY_UNAVAILABLE');

        const duplicateStack = await validateRotatedBlockPlacement(
            rotationInput({
                stacks: [
                    stack(0, 0, ['ground-anchor', 'candidate']),
                    stack(0, 0, ['ground-new-cell']),
                    stack(0, 1, ['ground-old-cell']),
                ],
            }),
        );
        expectFailure(duplicateStack);
    });
});
