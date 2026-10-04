import assert from 'node:assert/strict';
import { test } from 'node:test';
import { userAllowedPlantStatusTransitions } from './plantFieldStatusTransitions';

function canChangeStatus(from: string, to: string) {
    return userAllowedPlantStatusTransitions[from]?.includes(to) ?? false;
}

test('users can record every milestone from sowing through harvest', () => {
    const lifecycle = [
        'sowed',
        'sprouted',
        'firstFlowers',
        'firstFruitSet',
        'ready',
        'harvested',
    ];

    for (let index = 1; index < lifecycle.length; index += 1) {
        const from = lifecycle[index - 1];
        const to = lifecycle[index];
        assert.ok(canChangeStatus(from, to), `${from} should allow ${to}`);
    }
});

test('first fruits can progress to harvest readiness or plant failure', () => {
    assert.ok(canChangeStatus('firstFruitSet', 'ready'));
    assert.ok(canChangeStatus('firstFruitSet', 'died'));
    assert.equal(canChangeStatus('firstFruitSet', 'harvested'), false);
});

test('germination failure is available before sprouting and death after it', () => {
    assert.ok(canChangeStatus('sowed', 'notSprouted'));
    assert.equal(canChangeStatus('sowed', 'died'), false);
    for (const status of [
        'sprouted',
        'firstFlowers',
        'firstFruitSet',
        'ready',
    ]) {
        assert.ok(canChangeStatus(status, 'died'), status);
    }
});

test('sown plants must sprout before later growth or harvest milestones', () => {
    for (const target of [
        'firstFlowers',
        'firstFruitSet',
        'ready',
        'harvested',
    ]) {
        assert.equal(canChangeStatus('sowed', target), false, target);
    }
});

test('flowering and fruiting are optional milestones for harvest readiness', () => {
    assert.ok(canChangeStatus('sprouted', 'ready'));
    assert.ok(canChangeStatus('firstFlowers', 'ready'));
    assert.ok(canChangeStatus('sprouted', 'firstFruitSet'));
    assert.equal(canChangeStatus('sprouted', 'harvested'), false);
    assert.equal(canChangeStatus('firstFlowers', 'harvested'), false);
});

test('existing correction paths remain available', () => {
    assert.ok(canChangeStatus('sprouted', 'sowed'));
    assert.ok(canChangeStatus('sprouted', 'notSprouted'));
    for (const status of ['notSprouted', 'died', 'ready']) {
        assert.ok(canChangeStatus(status, 'sprouted'), status);
    }
});

test('planning, verification, removal and completed plants keep separate workflows', () => {
    for (const status of [
        'new',
        'planned',
        'pendingVerification',
        'harvested',
        'removed',
    ]) {
        assert.equal(userAllowedPlantStatusTransitions[status], undefined);
    }
    for (const targets of Object.values(userAllowedPlantStatusTransitions)) {
        assert.equal(targets.includes('removed'), false);
    }
});
