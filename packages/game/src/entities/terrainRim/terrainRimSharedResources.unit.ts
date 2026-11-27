import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createSharedTerrainRimResources } from './terrainRimSharedResources';

const settle = () => new Promise<void>((resolve) => queueMicrotask(resolve));

function counted() {
    const disposed: string[] = [];
    let built = 0;
    const resources = createSharedTerrainRimResources<{ name: string }>(
        (value) => disposed.push(value.name),
    );
    const create = (name: string) => () => {
        built += 1;
        return { name };
    };
    return { built: () => built, create, disposed, resources };
}

describe('shared terrain rim resources', () => {
    it('gives a second user the value the first one built', () => {
        const { built, create, resources } = counted();
        const garden = resources.hold('soil', create('soil'));
        const preview = resources.hold('soil', create('soil'));
        assert.equal(preview.value, garden.value);
        assert.equal(resources.peek('soil', create('soil')), garden.value);
        assert.equal(built(), 1);
    });

    it('keeps the value while any user holds it', async () => {
        const { built, create, disposed, resources } = counted();
        const garden = resources.hold('soil', create('soil'));
        // The HUD preview mounting and unmounting again and again.
        for (let drag = 0; drag < 5; drag += 1) {
            resources.hold('soil', create('soil')).release();
            await settle();
        }
        assert.deepEqual(disposed, []);
        assert.equal(built(), 1);
        garden.release();
        await settle();
        assert.deepEqual(disposed, ['soil']);
        assert.equal(resources.size, 0);
    });

    it('keeps a value through a release and hold in the same commit', async () => {
        const { built, create, disposed, resources } = counted();
        const first = resources.hold('rim', create('rim'));
        // React StrictMode runs the effect cleanup and setup back to back.
        first.release();
        const second = resources.hold('rim', create('rim'));
        await settle();
        assert.deepEqual(disposed, []);
        assert.equal(second.value, first.value);
        assert.equal(built(), 1);
        second.release();
        await settle();
        assert.deepEqual(disposed, ['rim']);
    });

    it('releases once however often release is called', async () => {
        const { create, disposed, resources } = counted();
        const garden = resources.hold('soil', create('soil'));
        const preview = resources.hold('soil', create('soil'));
        preview.release();
        preview.release();
        await settle();
        assert.deepEqual(disposed, []);
        garden.release();
        await settle();
        assert.deepEqual(disposed, ['soil']);
    });

    it('builds a new value after the last one was disposed', async () => {
        const { built, create, resources } = counted();
        const first = resources.hold('soil', create('soil'));
        first.release();
        await settle();
        const second = resources.hold('soil', create('soil'));
        assert.notEqual(second.value, first.value);
        assert.equal(built(), 2);
    });

    it('keeps keys apart', async () => {
        const { create, disposed, resources } = counted();
        const grass = resources.hold('lip:grass', create('grass'));
        const sand = resources.hold('lip:sand', create('sand'));
        assert.notEqual(grass.value, sand.value);
        sand.release();
        await settle();
        assert.deepEqual(disposed, ['sand']);
        assert.equal(resources.size, 1);
        grass.release();
    });
});
