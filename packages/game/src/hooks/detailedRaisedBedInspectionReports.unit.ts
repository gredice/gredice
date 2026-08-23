import assert from 'node:assert/strict';
import test from 'node:test';
import {
    detailedInspectionFarmerMessage,
    detailedInspectionFarmerMessages,
} from './detailedRaisedBedInspectionReports';

test('provides several Croatian farmer prompts for inspection notes', () => {
    assert.ok(detailedInspectionFarmerMessages.length > 2);
    assert.ok(
        detailedInspectionFarmerMessages.every((message) =>
            /gredic|pregled|bilješk/i.test(message),
        ),
    );
    assert.ok(
        detailedInspectionFarmerMessages.every((message) =>
            message.endsWith('...'),
        ),
    );
});

test('keeps the prompt stable for the same notification set', () => {
    assert.equal(
        detailedInspectionFarmerMessage(['notification-b', 'notification-a']),
        detailedInspectionFarmerMessage(['notification-a', 'notification-b']),
    );
});

test('does not show a farmer prompt without inspection notifications', () => {
    assert.equal(detailedInspectionFarmerMessage([]), null);
});
