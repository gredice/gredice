import assert from 'node:assert/strict';
import test from 'node:test';
import { getLocalSandboxBlockData } from '../../../../../../packages/game/src/localSandboxBlockData';
import {
    autumnLaunchFirstWaveNames,
    createAutumnLaunchFixture,
    resolveAutumnLaunchSize,
} from './profileAutumnLaunch';

test('autumn launch includes exact 24 first-wave identities and two separate legacy pilot props', () => {
    const fixture = createAutumnLaunchFixture('small');
    const directory = getLocalSandboxBlockData();
    assert.equal(new Set(autumnLaunchFirstWaveNames).size, 24);
    for (const name of [
        ...autumnLaunchFirstWaveNames,
        'StoneMedium',
        'EnamelGardenLamp',
    ]) {
        assert.equal(fixture.stats.blockCountsByName[name], 1, name);
        const matching = directory.filter(
            (row) => row.information.name === name,
        );
        assert.equal(matching.length, 1, name);
        const expectedWidth = [
            'HarvestWheelbarrow',
            'FallenLog',
            'AutumnBlanketBench',
        ].includes(name)
            ? 2
            : 1;
        assert.equal(
            matching[0]?.attributes.spanWidth ?? 1,
            expectedWidth,
            name,
        );
        assert.equal(matching[0]?.attributes.spanDepth ?? 1, 1, name);
    }
    assert.equal(fixture.stats.pilotIncludedPropCount, 12);
    assert.equal(fixture.stats.firstWavePropCount, 24);
    assert.equal(fixture.stats.legacyExtraPropCount, 2);
    assert.ok(
        fixture.stacks.every(
            (stack) => stack.blocks[0]?.name === 'Block_Grass',
        ),
    );
    assert.ok(
        fixture.stacks
            .flatMap((stack) => stack.blocks)
            .every((block) => block.variant === null),
    );
});
test('autumn launch density repeats deterministic exact contents without overlapping duplicate bases', () => {
    for (const size of ['small', 'medium', 'dense'] satisfies (
        | 'small'
        | 'medium'
        | 'dense'
    )[]) {
        const a = createAutumnLaunchFixture(size);
        assert.deepEqual(a, createAutumnLaunchFixture(size));
        const base = createAutumnLaunchFixture('small').stacks;
        assert.ok(
            base.every((s) =>
                a.stacks.some(
                    (n) =>
                        n.x === s.x &&
                        n.y === s.y &&
                        JSON.stringify(n.blocks) === JSON.stringify(s.blocks),
                ),
            ),
            'A populated central repeat must be shared across all density cases',
        );
        const blocks = a.stacks.flatMap((stack) => stack.blocks);
        assert.equal(new Set(blocks.map((b) => b.id)).size, blocks.length);
        assert.equal(a.stats.blockCount, blocks.length);
        assert.equal(a.stats.firstWavePropCount, 24 * a.stats.repetitions);
        assert.equal(a.stats.pilotIncludedPropCount, 12 * a.stats.repetitions);
        assert.ok(
            a.stacks.every(
                (s) =>
                    s.blocks.filter((b) => b.name === 'Block_Grass').length ===
                    1,
            ),
        );
        for (const s of a.stacks.filter((s) =>
            s.blocks.some((b) => b.name === 'HarvestWheelbarrow'),
        )) {
            assert.ok(
                a.stacks.some(
                    (n) =>
                        n.x === s.x + 1 &&
                        n.y === s.y &&
                        n.blocks[0]?.name === 'Block_Grass',
                ),
            );
        }
    }
    assert.equal(resolveAutumnLaunchSize('arbitrary'), null);
});
