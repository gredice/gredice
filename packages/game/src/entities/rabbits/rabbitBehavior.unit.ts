import assert from 'node:assert/strict';
import test from 'node:test';
import {
    getRabbitDwellSeconds,
    pickRabbitSettledBehavior,
    rabbitFleeHopSpeed,
    rabbitHopSpeed,
    shouldRabbitRoam,
} from './rabbitBehavior';

test('rabbit behavior selection exposes every required settled animation', () => {
    assert.equal(
        pickRabbitSettledBehavior(() => 0.1),
        'sit',
    );
    assert.equal(
        pickRabbitSettledBehavior(() => 0.4),
        'sniff',
    );
    assert.equal(
        pickRabbitSettledBehavior(() => 0.7),
        'groom',
    );
    assert.equal(
        pickRabbitSettledBehavior(() => 0.9),
        'nibble',
    );
});

test('rabbit pauses stay short but readable between hops', () => {
    assert.equal(
        getRabbitDwellSeconds('sit', () => 0),
        3.2,
    );
    assert.equal(
        getRabbitDwellSeconds('sit', () => 1),
        6.8,
    );
    assert.equal(
        getRabbitDwellSeconds('sniff', () => 0),
        1.4,
    );
    assert.equal(
        getRabbitDwellSeconds('groom', () => 1),
        4.6,
    );
    assert.equal(
        getRabbitDwellSeconds('nibble', () => 1),
        4.1,
    );
});

test('flee locomotion is quick and roaming is intentionally intermittent', () => {
    assert.ok(rabbitFleeHopSpeed > rabbitHopSpeed * 2);
    assert.equal(
        shouldRabbitRoam(() => 0.2),
        true,
    );
    assert.equal(
        shouldRabbitRoam(() => 0.8),
        false,
    );
});
