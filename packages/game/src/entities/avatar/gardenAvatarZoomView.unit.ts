import assert from 'node:assert/strict';
import test from 'node:test';
import {
    getGardenAvatarZoomReleaseView,
    getGardenAvatarZoomStart,
} from './gardenAvatarZoomView';

test('temporarily enters first person while zooming from third person', () => {
    const started = getGardenAvatarZoomStart('third-person');

    assert.deepEqual(started, {
        restoreThirdPerson: true,
        view: 'first-person',
    });
    assert.equal(
        getGardenAvatarZoomReleaseView({
            restoreThirdPerson: started.restoreThirdPerson,
            view: started.view,
        }),
        'third-person',
    );
});

test('keeps first person after zooming when zoom started there', () => {
    const started = getGardenAvatarZoomStart('first-person');

    assert.deepEqual(started, {
        restoreThirdPerson: false,
        view: 'first-person',
    });
    assert.equal(
        getGardenAvatarZoomReleaseView({
            restoreThirdPerson: started.restoreThirdPerson,
            view: started.view,
        }),
        'first-person',
    );
});

test('does not re-enter play mode when zoom ends after exiting to overview', () => {
    assert.equal(
        getGardenAvatarZoomReleaseView({
            restoreThirdPerson: true,
            view: 'overview',
        }),
        'overview',
    );
});
