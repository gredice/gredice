import assert from 'node:assert/strict';
import test from 'node:test';
import {
    defaultGameBackgroundPaletteIndex,
    gameBackgroundPalettes,
    getGameBackgroundPalette,
    getNextGameBackgroundPaletteIndex,
    normalizeGameBackgroundPaletteIndex,
} from './backgroundPalettes';

test('background palettes default to the current scene color', () => {
    assert.equal(
        getGameBackgroundPalette(defaultGameBackgroundPaletteIndex).kind,
        'current',
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
