import assert from 'node:assert/strict';
import test from 'node:test';
import { resolvePrecipitationFieldPosition } from './precipitationFieldPosition';

test('centers overview precipitation on the overview camera target', () => {
    assert.deepEqual(
        resolvePrecipitationFieldPosition({
            activeCameraPosition: { x: 30, z: 40 },
            avatarView: 'overview',
            followCamera: true,
            overviewTarget: [4, 0, -8],
        }),
        { x: 4, z: -8 },
    );
});

test('follows the active camera in both character views', () => {
    for (const avatarView of ['third-person', 'first-person'] as const) {
        assert.deepEqual(
            resolvePrecipitationFieldPosition({
                activeCameraPosition: { x: 12, z: -3 },
                avatarView,
                followCamera: true,
                overviewTarget: [99, 0, 99],
            }),
            { x: 12, z: -3 },
        );
    }
});

test('leaves local precipitation attached to its parent', () => {
    assert.equal(
        resolvePrecipitationFieldPosition({
            activeCameraPosition: { x: 12, z: -3 },
            avatarView: 'first-person',
            followCamera: false,
            overviewTarget: [99, 0, 99],
        }),
        null,
    );
});
