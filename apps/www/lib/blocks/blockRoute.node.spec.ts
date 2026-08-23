import assert from 'node:assert/strict';
import test from 'node:test';
import {
    getBlockRouteAlias,
    getBlockStaticParams,
    resolveBlockRoute,
    stoneCornerStairsBlockAlias,
} from './blockRoute.ts';

const legacyCornerStairs = {
    slug: 'kamene-polustube',
    information: {
        name: 'Block_Stone_Stairs_Half',
        label: 'Kamene polustube',
    },
};

const currentCornerStairs = {
    slug: 'kutne-kamene-stube',
    information: {
        name: 'Block_Stone_Stairs_Corner',
        label: 'Kutne kamene stube',
    },
};

test('canonical corner-stairs alias resolves the pre-rename catalogue entity', () => {
    assert.equal(
        resolveBlockRoute([legacyCornerStairs], stoneCornerStairsBlockAlias),
        legacyCornerStairs,
    );
    assert.equal(
        getBlockRouteAlias(legacyCornerStairs),
        stoneCornerStairsBlockAlias,
    );
    assert.deepEqual(getBlockStaticParams([legacyCornerStairs]), [
        { alias: stoneCornerStairsBlockAlias },
    ]);
});

test('canonical corner-stairs alias resolves the post-rename catalogue entity', () => {
    assert.equal(
        resolveBlockRoute([currentCornerStairs], stoneCornerStairsBlockAlias),
        currentCornerStairs,
    );
    assert.equal(
        getBlockRouteAlias(currentCornerStairs),
        stoneCornerStairsBlockAlias,
    );
    assert.deepEqual(getBlockStaticParams([currentCornerStairs]), [
        { alias: stoneCornerStairsBlockAlias },
    ]);
});

test('hybrid catalogue data still resolves and emits the canonical alias', () => {
    const currentNameWithLegacyLabel = {
        slug: '',
        information: {
            name: currentCornerStairs.information.name,
            label: legacyCornerStairs.information.label,
        },
    };
    const unrelatedNameWithCurrentLabel = {
        slug: '',
        information: {
            name: 'Block_Custom',
            label: currentCornerStairs.information.label,
        },
    };

    assert.equal(
        resolveBlockRoute(
            [currentNameWithLegacyLabel],
            stoneCornerStairsBlockAlias,
        ),
        currentNameWithLegacyLabel,
    );
    assert.equal(
        getBlockRouteAlias(currentNameWithLegacyLabel),
        stoneCornerStairsBlockAlias,
    );
    assert.equal(
        resolveBlockRoute(
            [unrelatedNameWithCurrentLabel],
            stoneCornerStairsBlockAlias,
        ),
        unrelatedNameWithCurrentLabel,
    );
});

test('post-rename corner stairs take priority when both catalogue forms exist', () => {
    const currentCornerStairsWithLegacyPresentation = {
        ...currentCornerStairs,
        slug: legacyCornerStairs.slug,
        information: {
            ...currentCornerStairs.information,
            label: legacyCornerStairs.information.label,
        },
    };

    assert.equal(
        resolveBlockRoute(
            [legacyCornerStairs, currentCornerStairsWithLegacyPresentation],
            stoneCornerStairsBlockAlias,
        ),
        currentCornerStairsWithLegacyPresentation,
    );
    assert.deepEqual(
        getBlockStaticParams([
            legacyCornerStairs,
            currentCornerStairsWithLegacyPresentation,
        ]),
        [{ alias: stoneCornerStairsBlockAlias }],
    );
});

test('ordinary block aliases and static params remain unchanged', () => {
    const ordinaryBlock = {
        slug: 'prilagodeni-slug',
        information: {
            name: 'Block_Stone',
            label: 'Kameni blok',
        },
    };

    assert.equal(
        resolveBlockRoute([ordinaryBlock], 'kameni-blok'),
        ordinaryBlock,
    );
    assert.equal(
        resolveBlockRoute([ordinaryBlock], 'prilagodeni-slug'),
        ordinaryBlock,
    );
    assert.equal(getBlockRouteAlias(ordinaryBlock), 'prilagodeni-slug');
    assert.deepEqual(getBlockStaticParams([ordinaryBlock]), [
        { alias: 'prilagodeni-slug' },
    ]);
    assert.equal(
        resolveBlockRoute([ordinaryBlock], stoneCornerStairsBlockAlias),
        undefined,
    );
});
