import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    createPumpkinTrailStacks,
    isPumpkinTrailComplete,
    isPumpkinTrailPublicPath,
    lightPumpkinTrailStop,
    pumpkinTrailStops,
} from './index';

test('five stable stops can be lit in any order with harmless repeats and no invalid IDs', () => {
    const original: readonly string[] = [];
    let lit = original;
    for (const stop of [...pumpkinTrailStops].reverse())
        lit = lightPumpkinTrailStop(lit, stop.id);
    assert.equal(isPumpkinTrailComplete(lit), true);
    assert.equal(
        lightPumpkinTrailStop(lit, pumpkinTrailStops[0]?.id ?? ''),
        lit,
    );
    assert.equal(lightPumpkinTrailStop(lit, 'customer-block'), lit);
    assert.deepEqual(original, []);
    assert.equal(isPumpkinTrailComplete([]), false);
    assert.equal(isPumpkinTrailComplete(['wrong-id']), false);
});
test('auth bypass accepts exactly this public route, without broad prefix matching', () => {
    for (const path of ['/staza-bundeva', '/staza-bundeva/'])
        assert.equal(isPumpkinTrailPublicPath(path), true);
    for (const path of [
        null,
        '/',
        '/staza-bundeva/private',
        '/staza-bundeva-extra',
        '/STAZA-BUNDEVA',
    ])
        assert.equal(isPumpkinTrailPublicPath(path), false);
});
test('authored supports, U path and decoration identities never overlap or alter source data', () => {
    const stacks = createPumpkinTrailStacks();
    assert.equal(stacks.length, 25);
    assert.equal(new Set(stacks.map((s) => `${s.x}:${s.y}`)).size, 25);
    const blocks = stacks.flatMap((s) => s.blocks);
    assert.equal(new Set(blocks.map((b) => b.id)).size, blocks.length);
    assert.equal(blocks.filter((b) => b.name === 'StoneWalkway').length, 9);
    assert.equal(
        blocks.filter((b) => b.name.startsWith('PumpkinLantern')).length,
        5,
    );
    for (const stop of pumpkinTrailStops) {
        const stack = stacks.find(
            (s) => s.x === stop.x - 2 && s.y === stop.z - 2,
        );
        assert.deepEqual(
            stack?.blocks.map((b) => b.name),
            ['Block_Grass', stop.name],
        );
        assert.equal(stack?.blocks[1]?.id, stop.id);
    }
    assert.equal(blocks.find((b) => b.name === 'BaleHey')?.rotation, 1);
    stacks[0]?.blocks.pop();
    assert.equal(createPumpkinTrailStacks()[0]?.blocks.length, 2);
});
