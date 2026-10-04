import assert from 'node:assert/strict';
import test from 'node:test';
import {
    actorSpeechDurationMs,
    beeSpeechMessages,
    birdSpeechMessages,
    catSpeechMessages,
    chickenSpeechMessages,
    dogSpeechMessages,
    pickActorSpeechMessage,
    pigletSpeechMessages,
    playerSpeechMessages,
    squirrelSpeechMessages,
} from './actorSpeechMessages';

test('keeps actor speech visible for five seconds by default', () => {
    assert.equal(actorSpeechDurationMs, 5_000);
});

test('provides speech for every interactive animal and the player', () => {
    assert.ok(catSpeechMessages.length > 1);
    assert.ok(chickenSpeechMessages.length > 1);
    assert.ok(dogSpeechMessages.length > 1);
    assert.ok(pigletSpeechMessages.length > 1);
    assert.ok(birdSpeechMessages.length > 1);
    assert.ok(beeSpeechMessages.length > 1);
    assert.ok(squirrelSpeechMessages.length > 1);
    assert.ok(playerSpeechMessages.length > 1);
    assert.ok(
        playerSpeechMessages.every((message) => /vrt|vrtu/i.test(message)),
    );
});

test('picks a message using the supplied random source', () => {
    assert.equal(
        pickActorSpeechMessage({
            messages: ['prva', 'druga', 'treća'],
            random: () => 0.5,
        }),
        'druga',
    );
});

test('does not immediately repeat a message when alternatives exist', () => {
    assert.equal(
        pickActorSpeechMessage({
            messages: ['prva', 'druga', 'treća'],
            previousMessage: 'prva',
            random: () => 0,
        }),
        'druga',
    );
});

test('returns null for an empty message collection', () => {
    assert.equal(pickActorSpeechMessage({ messages: [] }), null);
});
