import assert from 'node:assert/strict';
import test from 'node:test';
import { getRaisedBedCloseupUrl } from './gardenUrls';

test('builds a raised-bed field deep link with the requested plant-details tab', () => {
    assert.match(
        getRaisedBedCloseupUrl('Moja gredica', {
            fieldTab: 'diary',
            positionIndex: 2,
        }),
        /\?gredica=Moja%20gredica&polje=3&polje-kartica=diary$/u,
    );
});

test('does not add a field tab without a valid field position', () => {
    assert.doesNotMatch(
        getRaisedBedCloseupUrl('Moja gredica', { fieldTab: 'diary' }),
        /polje-kartica/u,
    );
});
