import assert from 'node:assert/strict';
import test from 'node:test';
import {
    defaultGameBackgroundPaletteIndex,
    defaultGameBackgroundPaletteKey,
    gameBackgroundPalettes,
    getGameBackgroundPalette,
    getGameBackgroundPaletteIndexByKey,
    getGameBackgroundPaletteKey,
    getNextGameBackgroundPaletteIndex,
    getNextGameBackgroundPaletteKey,
    normalizeGameBackgroundPaletteIndex,
} from './backgroundPalettes';

test('background palettes default to the current scene color', () => {
    assert.equal(
        getGameBackgroundPalette(defaultGameBackgroundPaletteIndex).kind,
        'current',
    );
    assert.equal(
        getGameBackgroundPaletteKey(defaultGameBackgroundPaletteIndex),
        defaultGameBackgroundPaletteKey,
    );
});

test('background palette indexes wrap around the available palette list', () => {
    assert.equal(
        normalizeGameBackgroundPaletteIndex(-1),
        gameBackgroundPalettes.length - 1,
    );
    assert.equal(
        normalizeGameBackgroundPaletteIndex(gameBackgroundPalettes.length),
        defaultGameBackgroundPaletteIndex,
    );
    assert.equal(
        getNextGameBackgroundPaletteIndex(gameBackgroundPalettes.length - 1),
        defaultGameBackgroundPaletteIndex,
    );
});

test('background palette keys resolve and wrap by stable key', () => {
    assert.equal(getGameBackgroundPaletteIndexByKey('purple'), 2);
    assert.equal(
        getGameBackgroundPaletteIndexByKey('missing'),
        defaultGameBackgroundPaletteIndex,
    );
    assert.equal(getNextGameBackgroundPaletteKey('rose'), 'current');
});
