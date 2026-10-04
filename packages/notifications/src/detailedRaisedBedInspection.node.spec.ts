import assert from 'node:assert/strict';
import test from 'node:test';
import { detailedRaisedBedInspectionNotificationType } from '@gredice/js/notifications';
import { buildDetailedRaisedBedInspectionNotification } from './detailedRaisedBedInspection';

test('builds a garden-scoped detailed inspection notification with operation identity', () => {
    const notification = buildDetailedRaisedBedInspectionNotification({
        gardenId: 8,
        operationId: 42,
        raisedBedId: 17,
        raisedBedName: 'Gredica Sjever',
    });

    assert.equal(notification.category, 'garden');
    assert.equal(
        notification.type,
        detailedRaisedBedInspectionNotificationType,
    );
    assert.deepEqual(notification.metadata, { operationId: 42 });
    assert.equal(notification.gardenId, 8);
    assert.equal(notification.raisedBedId, 17);
    assert.match(notification.content, /Gredica Sjever/);
    assert.match(notification.linkUrl, /gredica=Gredica%20Sjever/);
});
