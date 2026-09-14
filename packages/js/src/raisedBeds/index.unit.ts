import assert from 'node:assert/strict';
import test from 'node:test';
import { getFieldPhysicalPositionIndex } from './index';

test('physical positions use block order independently of the input order', () => {
    const beds = [{ id: 502 }, { id: 501 }];
    assert.equal(
        getFieldPhysicalPositionIndex(
            { raisedBedId: 502, positionIndex: 0 },
            beds,
        ),
        10,
    );
    assert.equal(
        getFieldPhysicalPositionIndex(
            { raisedBedId: 501, positionIndex: 8 },
            beds,
        ),
        9,
    );
    assert.equal(
        getFieldPhysicalPositionIndex({ raisedBedId: 502, positionIndex: 17 }, [
            { id: 502 },
        ]),
        18,
    );
});
