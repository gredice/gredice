import assert from 'node:assert/strict';
import test from 'node:test';
import {
    getPersistentPetHomeBlockSpec,
    persistentPetHomeBlockSpecs,
} from '../scripts/lib/persistentPetHomeCatalog';

test('new persistent pets each publish through a distinct home block', () => {
    assert.deepEqual(
        persistentPetHomeBlockSpecs.map(({ name }) => name),
        [
            'RabbitHutch',
            'HorseStable',
            'CowShelter',
            'GoatShelter',
            'SheepFold',
        ],
    );

    for (const spec of persistentPetHomeBlockSpecs) {
        assert.equal(spec.attributes['information.name'], spec.name);
        assert.equal(spec.attributes['attributes.stackable'], 'false');
        assert.equal(spec.attributes['attributes.placeableOnWater'], 'false');
        assert.equal(spec.attributes['attributes.type'], 'decoration');
        assert.equal(
            JSON.parse(spec.attributes['image.cover'] ?? '{}').url,
            `https://www.gredice.com/assets/blocks/${spec.name}.webp`,
        );
        assert.ok(Number(spec.attributes['prices.sunflowers']) > 0);
    }
});

test('large animal homes occupy their complete two-by-two footprint', () => {
    for (const name of ['HorseStable', 'CowShelter', 'SheepFold']) {
        const spec = getPersistentPetHomeBlockSpec(name);
        assert.ok(spec);
        assert.equal(spec.attributes['attributes.spanDepth'], '2');
        assert.equal(spec.attributes['attributes.spanWidth'], '2');
        assert.ok(Number(spec.attributes['attributes.hitboxDepth']) > 1);
        assert.ok(Number(spec.attributes['attributes.hitboxWidth']) > 1);
    }
});
