import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSuncokretSystemPrompt } from './suncokretContext';

test('buildSuncokretSystemPrompt identifies the focused raised bed by name and id', () => {
    const prompt = buildSuncokretSystemPrompt({
        garden: { id: 12, name: 'Aleksov vrt' },
        raisedBed: { id: 34, name: 'Sunčano Sunce', status: 'active' },
        uiContext: { surface: 'raised-bed' },
    });

    assert.match(
        prompt,
        /Korisnik trenutačno gleda gredicu "Sunčano Sunce" \(ID 34, status active\) u vrtu "Aleksov vrt" \(ID 12\)\./,
    );
    assert.match(
        prompt,
        /Trenutna gredica u fokusu: "Sunčano Sunce" \(ID 34, status active\)\./,
    );
});

test('buildSuncokretSystemPrompt describes the active settings section', () => {
    const prompt = buildSuncokretSystemPrompt({
        garden: { id: 12, name: 'Aleksov vrt' },
        uiContext: { surface: 'settings', section: 'igra' },
    });

    assert.match(prompt, /Korisnik trenutačno gleda postavke igre u sučelju\./);
    assert.doesNotMatch(prompt, /gredicu .* u fokusu: "/);
});
