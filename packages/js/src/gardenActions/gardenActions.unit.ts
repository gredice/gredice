import assert from 'node:assert/strict';
import test from 'node:test';
import { gardenActionPath, gardenActionUrl, readGardenAction } from './index';

test('plant, variety and operation links round-trip through the shared contract', () => {
    for (const action of [
        { type: 'sow', plantId: 1 },
        { type: 'sow', plantId: 1, sortId: 101 },
        { type: 'operation', operationId: 501 },
    ] as const) {
        const url = new URL(gardenActionUrl('https://vrt.gredice.com', action));
        assert.deepEqual(readGardenAction(url.searchParams), action);
        assert.equal(`${url.pathname}${url.search}`, gardenActionPath(action));
    }
});

test('rejects invalid, ambiguous, unsafe and incomplete action identifiers', () => {
    for (const query of [
        '',
        'sorta=1',
        'sijanje=0',
        'sijanje=-1',
        'sijanje=1.5',
        'sijanje=01',
        'sijanje=NaN',
        'sijanje=9007199254740992',
        'sijanje=1&sorta=',
        'sijanje=1&radnja=2',
        'radnja=2&sorta=1',
        'radnja=1&radnja=2',
        'sijanje=1&sijanje=2',
    ]) {
        assert.equal(readGardenAction(new URLSearchParams(query)), null, query);
    }
});
