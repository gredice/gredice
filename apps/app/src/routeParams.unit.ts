import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePositiveIntegerRouteParam } from './routeParams';

test('parses a positive integer route parameter', () => {
    assert.equal(parsePositiveIntegerRouteParam('134'), 134);
});

test('rejects malformed and non-positive route parameters', () => {
    assert.equal(parsePositiveIntegerRouteParam(''), null);
    assert.equal(parsePositiveIntegerRouteParam('0'), null);
    assert.equal(parsePositiveIntegerRouteParam('-1'), null);
    assert.equal(parsePositiveIntegerRouteParam('1.5'), null);
    assert.equal(parsePositiveIntegerRouteParam('1e2'), null);
    assert.equal(parsePositiveIntegerRouteParam('134abc'), null);
});

test('rejects integers outside the safe range', () => {
    assert.equal(
        parsePositiveIntegerRouteParam(
            (Number.MAX_SAFE_INTEGER + 1).toString(),
        ),
        null,
    );
});
