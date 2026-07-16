import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { notificationCenterRoles } from './notificationRouteRoles';

const notificationRoutesSource = readFileSync(
    new URL('../../app/api/[...route]/notificationsRoutes.ts', import.meta.url),
    'utf8',
);

function routeBlock(method: string, path: string) {
    const marker = `.${method}(\n        '${path}',`;
    const start = notificationRoutesSource.indexOf(marker);
    assert.notEqual(start, -1, `Missing ${method.toUpperCase()} ${path}`);
    const next = notificationRoutesSource.indexOf(
        '\n    .',
        start + marker.length,
    );
    return notificationRoutesSource.slice(
        start,
        next === -1 ? undefined : next,
    );
}

test('notification center routes allow Farm farmer users', () => {
    assert.deepEqual(notificationCenterRoles, ['user', 'farmer', 'admin']);
});

test('notification self-service routes use notification center roles', () => {
    const selfServiceRoutes = [
        ['get', '/'],
        ['put', '/'],
        ['patch', '/:id'],
        ['get', '/preferences'],
        ['put', '/preferences'],
        ['post', '/devices'],
        ['get', '/devices'],
        ['patch', '/devices/:id'],
        ['delete', '/devices/:id'],
        ['get', '/push-status'],
        ['post', '/events'],
        ['post', '/test'],
    ] as const;

    for (const [method, path] of selfServiceRoutes) {
        assert.match(
            routeBlock(method, path),
            /authValidator\(\[\.\.\.notificationCenterRoles\]\)/,
            `${method.toUpperCase()} ${path} must allow notification center roles`,
        );
    }
});

test('notification campaign routes remain admin-only', () => {
    const campaignRoutes = [
        ['post', '/campaigns/preview'],
        ['post', '/campaigns'],
        ['get', '/campaigns/:id'],
        ['post', '/campaigns/:id/preview'],
        ['post', '/campaigns/:id/enqueue'],
        ['post', '/campaigns/:id/cancel'],
    ] as const;

    for (const [method, path] of campaignRoutes) {
        const block = routeBlock(method, path);
        assert.match(
            block,
            /authValidator\(\['admin'\]\)/,
            `${method.toUpperCase()} ${path} must remain admin-only`,
        );
        assert.doesNotMatch(block, /notificationCenterRoles/);
    }
});

test('notification mutation does not reveal out-of-scope notification IDs', () => {
    const block = routeBlock('patch', '/:id');
    assert.equal(block.match(/Notification not found/g)?.length, 2);
    assert.doesNotMatch(block, /Unauthorized access to notification/);
});
