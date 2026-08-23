import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeSearchText } from '../search/normalizeSearchText.ts';
import { gardenPetMatchesSearch } from './gardenPetSearch.ts';
import { gardenPets } from './gardenPets.ts';

function matchingPetNames(search: string) {
    return gardenPets
        .filter((pet) =>
            gardenPetMatchesSearch(pet, normalizeSearchText(search)),
        )
        .map((pet) => pet.name);
}

test('empty search keeps every pet visible', () => {
    assert.deepEqual(matchingPetNames(''), [
        'Zec',
        'Pas',
        'Mačka',
        'Kokoš',
        'Praščić',
    ]);
});

test('searching a pet name matches only that pet', () => {
    assert.deepEqual(matchingPetNames('pas'), ['Pas']);
    assert.deepEqual(matchingPetNames('Mačka'), ['Mačka']);
    assert.deepEqual(matchingPetNames('kunić'), ['Zec']);
});

test('searching the visible category label keeps the whole group discoverable', () => {
    for (const search of ['ljubimci', 'Ljubimci', 'ljubimac', 'životinje']) {
        assert.equal(
            matchingPetNames(search).length,
            gardenPets.length,
            search,
        );
    }
});

test('searching an unrelated term hides every pet', () => {
    assert.deepEqual(matchingPetNames('ograda'), []);
});

test('every pet has a home block and a unique slug', () => {
    const slugs = gardenPets.map((pet) => pet.slug);
    assert.equal(new Set(slugs).size, slugs.length);

    for (const pet of gardenPets) {
        assert.ok(pet.homeBlockName.length > 0, pet.slug);
        assert.equal(pet.slug, normalizeSearchText(pet.slug));
    }
});
