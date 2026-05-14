import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getNewRaisedBedPlantingNote } from './cartInfo';

describe('getNewRaisedBedPlantingNote', () => {
    it('uses singular raised-bed copy for two raised-bed blocks', () => {
        assert.strictEqual(
            getNewRaisedBedPlantingNote(8, 2),
            'Potrebno je još 8 biljaka u ovoj gredici za postavljanje nove gredice.',
        );
    });

    it('uses plural raised-bed copy for multiple raised beds', () => {
        assert.strictEqual(
            getNewRaisedBedPlantingNote(18, 4),
            'Potrebno je još 18 biljaka u novim gredicama za postavljanje novih gredica.',
        );
    });
});
