import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const actionsSource = readFileSync(
    new URL('./operationActions.ts', import.meta.url),
    'utf8',
);

function sourceBetween(startMarker: string, endMarker: string) {
    const start = actionsSource.indexOf(startMarker);
    const end = actionsSource.indexOf(endMarker, start);

    assert.notEqual(start, -1, `Missing source marker: ${startMarker}`);
    assert.notEqual(end, -1, `Missing source marker: ${endMarker}`);

    return actionsSource.slice(start, end);
}

test('publishes detailed inspections only from verified operation handling', () => {
    const verifiedNotificationBlock = sourceBetween(
        'async function notifyVerifiedOperationCompletion(',
        'async function verifyOperationCompletion(',
    );
    const completionBlock = sourceBetween(
        'async function completeOperationForActor(',
        'export async function completeOperation(',
    );

    assert.match(
        verifiedNotificationBlock,
        /await notifyDetailedRaisedBedInspectionVerified\(operation\.id\)/,
    );
    assert.doesNotMatch(
        completionBlock,
        /notifyDetailedRaisedBedInspectionVerified/,
    );
});

test('completed assignment corrections do not notify farmers about new work', () => {
    const assignmentBlock = sourceBetween(
        'async function assignOperationUser(',
        'export async function assignOperationUserAction(',
    );

    assert.match(
        assignmentBlock,
        /if \(\s*operation\.status !== 'pendingVerification' &&\s*assignment\.newlyAssignedUserIds\.length > 0\s*\) \{\s*await notifyOperationAssignedUsers\(/,
    );
    assert.match(
        assignmentBlock,
        /await revalidateOperationPaths\(operation\)/,
    );
});
