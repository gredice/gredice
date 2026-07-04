import assert from 'node:assert/strict';
import test from 'node:test';
import { notificationCenterRoles } from './notificationRouteRoles';

test('notification center routes allow Farm farmer users', () => {
    assert.deepEqual(notificationCenterRoles, ['user', 'farmer', 'admin']);
});
