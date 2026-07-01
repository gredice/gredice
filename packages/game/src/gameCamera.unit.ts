import assert from 'node:assert/strict';
import test from 'node:test';
import {
    closeupGameCameraZoom,
    extraSmallCloseupGameCameraZoom,
    getCloseupGameCameraZoom,
    tinyCloseupGameCameraZoom,
} from './gameCamera';

test('closeup camera keeps the default zoom on roomy viewports', () => {
    assert.equal(
        getCloseupGameCameraZoom({ height: 812, width: 414 }),
        closeupGameCameraZoom,
    );
});

test('closeup camera zooms out on extra-small phone widths', () => {
    assert.equal(
        getCloseupGameCameraZoom({ height: 760, width: 375 }),
        extraSmallCloseupGameCameraZoom,
    );
});

test('closeup camera zooms out further on tiny or short viewports', () => {
    assert.equal(
        getCloseupGameCameraZoom({ height: 740, width: 320 }),
        tinyCloseupGameCameraZoom,
    );
    assert.equal(
        getCloseupGameCameraZoom({ height: 600, width: 414 }),
        tinyCloseupGameCameraZoom,
    );
});
