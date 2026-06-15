import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Vector3 } from 'three';
import type { Block } from '../types/Block';
import type { Stack } from '../types/Stack';
import {
    advanceBeachBallBounce,
    type BeachBallBounceState,
    createBeachBallBounceEnvironment,
    isBeachBallPassableTerrainBlockName,
} from './beachBallBounce';

function block(name: string, id = name, rotation = 0): Block {
    return {
        id,
        name,
        rotation,
    };
}

function stack(x: number, z: number, blocks: Block[]): Stack {
    return {
        blocks,
        position: new Vector3(x, 0, z),
    };
}

function activeState(
    state: Partial<BeachBallBounceState>,
): BeachBallBounceState {
    return {
        active: true,
        elapsedSeconds: 0,
        offsetX: 0,
        offsetZ: 0,
        velocityX: 0,
        velocityZ: 0,
        ...state,
    };
}

describe('beach ball bounce', () => {
    it('ignores terrain and the moving beach ball block as obstacles', () => {
        const environment = createBeachBallBounceEnvironment({
            movingBlockId: 'ball',
            stacks: [
                stack(0, 0, [block('Block_Grass'), block('BeachBall', 'ball')]),
                stack(1, 0, [block('Block_Sand_Corner')]),
                stack(2, 0, [block('Block_Water')]),
            ],
        });

        assert.equal(isBeachBallPassableTerrainBlockName('Block_Water'), true);
        assert.deepEqual(environment.obstacles, []);

        const nextState = advanceBeachBallBounce(
            activeState({ velocityX: 1.5 }),
            environment,
            {
                baseX: 0,
                baseZ: 0,
                deltaSeconds: 0.2,
            },
        );

        assert.ok(nextState.offsetX > 0);
        assert.ok(nextState.velocityX > 0);
    });

    it('reflects velocity before entering an occupied block cell', () => {
        const environment = createBeachBallBounceEnvironment({
            movingBlockId: 'ball',
            stacks: [
                stack(0, 0, [block('Block_Grass'), block('BeachBall', 'ball')]),
                stack(1, 0, [
                    block('Block_Grass'),
                    block('BeachChair', 'chair'),
                ]),
            ],
        });

        const nextState = advanceBeachBallBounce(
            activeState({ offsetX: 0.25, velocityX: 3 }),
            environment,
            {
                baseX: 0,
                baseZ: 0,
                deltaSeconds: 0.2,
            },
        );

        assert.ok(nextState.offsetX < 0.25);
        assert.ok(nextState.velocityX < 0);
    });

    it('uses multi-block footprint spans for obstacle cells', () => {
        const environment = createBeachBallBounceEnvironment({
            blockData: [
                {
                    attributes: {
                        spanDepth: 1,
                        spanWidth: 2,
                    },
                    information: {
                        name: 'LemonadeStand',
                    },
                },
            ],
            movingBlockId: 'ball',
            stacks: [
                stack(0, 0, [block('Block_Grass'), block('BeachBall', 'ball')]),
                stack(1, 0, [
                    block('Block_Grass'),
                    block('LemonadeStand', 'stand'),
                ]),
            ],
        });

        assert.deepEqual(
            environment.obstacles.sort((left, right) => left.x - right.x),
            [
                { x: 1, z: 0 },
                { x: 2, z: 0 },
            ],
        );
    });

    it('bounces off the garden bounds', () => {
        const environment = createBeachBallBounceEnvironment({
            movingBlockId: 'ball',
            stacks: [
                stack(0, 0, [block('Block_Grass')]),
                stack(1, 0, [block('Block_Grass'), block('BeachBall', 'ball')]),
            ],
        });

        const nextState = advanceBeachBallBounce(
            activeState({ offsetX: 0.22, velocityX: 4 }),
            environment,
            {
                baseX: 1,
                baseZ: 0,
                deltaSeconds: 0.2,
            },
        );

        assert.ok(nextState.offsetX < 0.22);
        assert.ok(nextState.velocityX < 0);
    });
});
