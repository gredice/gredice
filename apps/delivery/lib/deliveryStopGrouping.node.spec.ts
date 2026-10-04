import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildDeliveryStopKey,
    groupByDeliveryStop,
} from './deliveryStopGrouping';

test('groups deliveries at the same normalized address in the same slot', () => {
    const firstStopKey = buildDeliveryStopKey(12, 'Ilica 1, 10000 Zagreb, HR');
    const secondStopKey = buildDeliveryStopKey(
        12,
        '  ILICA 1 ,  10000 Zagreb, HR  ',
    );
    const otherSlotKey = buildDeliveryStopKey(13, 'Ilica 1, 10000 Zagreb, HR');
    const groups = groupByDeliveryStop([
        { requestId: 'first', stopKey: firstStopKey },
        { requestId: 'second', stopKey: secondStopKey },
        { requestId: 'later', stopKey: otherSlotKey },
    ]);

    assert.equal(firstStopKey, secondStopKey);
    assert.equal(groups.length, 2);
    assert.deepEqual(
        groups.map((group) =>
            group.items.map((delivery) => delivery.requestId),
        ),
        [['first', 'second'], ['later']],
    );
});
