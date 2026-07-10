import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildSuncokretFinalAnswerSystemPrompt,
    buildSuncokretSystemPrompt,
} from './suncokretContext';

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

test('buildSuncokretSystemPrompt directs weather context through weather tools', () => {
    const prompt = buildSuncokretSystemPrompt({
        garden: { id: 12, name: 'Aleksov vrt' },
        uiContext: { surface: 'weather', view: 'forecast' },
    });

    assert.match(prompt, /gleda vremensku prognozu u sučelju/);
    assert.match(prompt, /upotrijebi alate za aktualno vrijeme i prognozu/);
});

test('buildSuncokretSystemPrompt identifies the raised-bed details tab', () => {
    const prompt = buildSuncokretSystemPrompt({
        garden: { id: 12, name: 'Aleksov vrt' },
        raisedBed: { id: 34, name: 'Sunčano Sunce', status: 'active' },
        uiContext: { surface: 'raised-bed-details', tab: 'operations' },
    });

    assert.match(
        prompt,
        /karticu "Radnje" u detaljima gredice "Sunčano Sunce" \(ID 34\)/,
    );
});

test('buildSuncokretSystemPrompt identifies the plant details tab and field', () => {
    const prompt = buildSuncokretSystemPrompt({
        garden: { id: 12, name: 'Aleksov vrt' },
        positionIndex: 10,
        raisedBed: { id: 34, name: 'Sunčano Sunce', status: 'active' },
        uiContext: { surface: 'plant-details', tab: 'diary' },
    });

    assert.match(
        prompt,
        /karticu "Dnevnik" u detaljima biljke na gredici "Sunčano Sunce" \(ID 34, polje 11\)/,
    );
});

test('buildSuncokretFinalAnswerSystemPrompt forbids internal tool protocols', () => {
    const prompt = buildSuncokretFinalAnswerSystemPrompt('Osnovne upute.');

    assert.match(prompt, /više ne koristi alate/);
    assert.match(prompt, /Nikada ne ispisuj poziv alata, DSML, XML, JSON/);
    assert.match(prompt, /običnim hrvatskim jezikom/);
});
