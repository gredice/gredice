import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_AUDIO_CONFIG } from '../utils/audioConfig';
import { createGameAudio } from './audioMixer';

test('keeps audio store snapshots stable between updates', () => {
    const audio = createGameAudio({ ...DEFAULT_AUDIO_CONFIG });

    try {
        const initialSnapshot = audio.getState();

        assert.equal(
            audio.getState(),
            initialSnapshot,
            'getState must return the cached snapshot until the store emits',
        );

        let notifications = 0;
        const unsubscribe = audio.subscribe(() => {
            notifications += 1;
        });

        audio.setMasterMuted(true);

        const updatedSnapshot = audio.getState();

        assert.equal(notifications, 1);
        assert.notEqual(updatedSnapshot, initialSnapshot);
        assert.equal(updatedSnapshot.master.isMuted, true);
        assert.equal(audio.getState(), updatedSnapshot);

        unsubscribe();
    } finally {
        audio.dispose();
    }
});
